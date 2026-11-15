<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\CorrectionRequest;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Integrations\Models\Outbox;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\Icd10Code;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChartApiTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const SOAP = ['S' => 'Ngilu gigi 16.', 'O' => 'Karies 16 oklusal.', 'A' => ['codes' => ['K02.1'], 'text' => 'Karies dentin'],
        'P' => ['codes' => ['23.2'], 'text' => 'Tumpatan']];

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** New visit (from a booked appointment without a visit) with a draft note at revision 1. */
    private function draftVisit(): string
    {
        $appt = $this->inA(fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => self::SOAP])->assertOk()->assertJsonPath('revision', 1);

        return $visit;
    }

    private function sign(string $visit, array $body = [], string $email = self::DOC)
    {
        return $this->as($email)->postJson("/api/visits/$visit/selesai", $body + ['revision' => 1, 'confirm' => true]);
    }

    private function noteOf(string $visit): ClinicalNote
    {
        return $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->with('versions')->firstOrFail());
    }

    private function addSecondDentist(): string
    {
        $u = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Kedua Contoh', 'dokter_gigi');
        $this->inA(fn () => Membership::create(['user_id' => $u->id, 'role' => 'dentist']));

        return $u->email;
    }

    public function test_draft_to_sign_happy_path(): void
    {
        $visit = $this->draftVisit();
        $f = $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 16, 'surface' => 'O', 'condition' => 'karies', 'source' => 'ai_draft'])
            ->assertCreated()->assertJsonPath('state', 'draft')->json('id');
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 16, 'surface' => null, 'condition' => 'mahkota'])->assertCreated();

        // an agent draft must be approved ("Setujui") before Selesai; approval keeps source ai_draft for provenance
        $this->sign($visit)->assertUnprocessable()->assertJsonPath('error', 'unapproved_drafts')->assertJsonPath('finding_ids', [$f]);
        $this->as(self::DOC)->postJson("/api/visits/$visit/approve-drafts")->assertOk()->assertJsonPath('approved.findings', 1)
            ->assertJsonPath('pending.finding_ids', []);
        $this->sign($visit)->assertOk()->assertJsonPath('findings_locked', 2)->assertJsonPath('visit.status', 'selesai');

        $v = $this->noteOf($visit)->versions->first();
        $this->assertSame(['signed', $this->user(self::DOC)->id, Soap::hash(self::SOAP)], [$v->state, $v->signed_by, $v->content_hash]);
        $finding = $this->inA(fn () => ToothFinding::find($f));
        $this->assertSame(['final', 'ai_draft', $this->user(self::DOC)->id], [$finding->state, $finding->source, $finding->approved_by]);
        $this->assertTrue($this->inA(fn () => Outbox::where('idempotency_key', "satusehat:note_version:{$v->id}")->exists()));
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tanda_tangan')->where('entity_id', $v->id)->exists()));

        $patient = $this->noteOf($visit)->patient_id;
        $c = $this->as(self::DOC)->getJson("/api/patients/$patient/chart")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $visitJson = collect($c->json('visits'))->firstWhere('id', $visit);
        $this->assertSame('berlaku', $visitJson['notes'][0]['versions'][0]['status']);
        $this->assertSame(self::SOAP['A'], $visitJson['notes'][0]['versions'][0]['soap']['A']);
        $this->assertContains($f, array_column($c->json('findings'), 'id'));
    }

    public function test_signed_note_and_findings_reject_edits_with_409_and_db_trigger(): void
    {
        $visit = $this->draftVisit();
        $f = $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 21, 'surface' => 'I', 'condition' => 'karies'])->json('id');
        $this->sign($visit)->assertOk();

        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => self::SOAP])->assertStatus(409)->assertJsonPath('error', 'signed');
        $this->as(self::DOC)->patchJson("/api/findings/$f", ['condition' => 'tambalan'])->assertStatus(409);
        $this->as(self::DOC)->deleteJson("/api/findings/$f")->assertStatus(409);
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 22, 'surface' => 'I', 'condition' => 'karies'])->assertStatus(409);
        $this->sign($visit)->assertOk(); // second Selesai: idempotent, nothing re-signed

        // DB backstop (as ehr_app): trigger rejects UPDATE of the signed version / final finding; no DELETE grant at all.
        $v = $this->noteOf($visit)->versions->first();
        foreach ([fn () => $v->update(['reason' => 'diam-diam']), fn () => $v->delete(),
            fn () => ToothFinding::find($f)->update(['condition' => 'sehat']), fn () => ToothFinding::find($f)->delete()] as $i => $op) {
            try {
                $this->inA($op);
                $this->fail("op $i not rejected");
            } catch (QueryException $e) {
                $this->assertContains($e->errorInfo[0], ['45000', '42000'], "op $i");
            }
        }
        $this->assertSame(Soap::hash(self::SOAP), $this->noteOf($visit)->versions->first()->content_hash);
    }

    public function test_only_dentist_role_may_sign(): void
    {
        $visit = $this->inA(fn () => Visit::whereNotNull('appointment_id')->firstOrFail()->id); // seeded draft (Kemang)
        foreach (['asisten@senyum.test', 'pemilik@senyum.test', 'depan@senyum.test'] as $email) {
            $this->sign($visit, email: $email)->assertForbidden();
        }
        $this->assertSame('draft', $this->noteOf($visit)->versions->first()->state);
    }

    public function test_dentist_who_is_not_the_author_cannot_sign(): void
    {
        $visit = $this->draftVisit();
        $this->sign($visit, email: $this->addSecondDentist())->assertForbidden();
        $this->assertSame('draft', $this->noteOf($visit)->versions->first()->state);
    }

    public function test_missing_confirmation_is_403_and_no_totp_is_asked(): void
    {
        $visit = $this->draftVisit();
        $this->sign($visit, ['confirm' => false])->assertForbidden()->assertJsonPath('error', 'confirmation_required');
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1])->assertForbidden();
        $this->sign($visit, ['confirm' => 'true'])->assertForbidden(); // must be a real boolean
        $this->assertSame('draft', $this->noteOf($visit)->versions->first()->state);
        $this->assertSame(3, $this->inA(fn () => AuditEvent::where('action', 'tanda_tangan_ditolak')->count()));
        // the separate TOTP re-prompt is gone (#54): confirm alone signs when the clinic does not require a PIN
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
    }

    public function test_stale_revision_is_409(): void
    {
        $visit = $this->draftVisit();
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => self::SOAP])->assertOk()->assertJsonPath('revision', 2);
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => self::SOAP])->assertStatus(409)->assertJsonPath('revision', 2);
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => self::SOAP])->assertStatus(409);
        $this->sign($visit)->assertStatus(409)->assertJsonPath('error', 'stale'); // signing what you did not see is refused
    }

    public function test_visit_from_appointment_is_idempotent(): void
    {
        $appt = $this->inA(fn () => Appointment::orderByDesc('starts_at')->firstOrFail());
        $a = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $b = $this->as('asisten@senyum.test')->postJson("/api/appointments/{$appt->id}/visit");
        if ($b->status() !== 403) { // assistant only covers Kemang
            $this->assertSame($a, $b->assertOk()->json('id'));
        }
        $this->assertSame($a, $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertOk()->json('id'));
        $this->assertSame(1, $this->inA(fn () => Visit::where('appointment_id', $appt->id)->count()));
        $this->as('depan@senyum.test')->postJson("/api/appointments/{$appt->id}/visit")->assertForbidden();
    }

    public function test_correction_within_48h_creates_v2_and_keeps_v1(): void
    {
        $visit = $this->draftVisit();
        $this->sign($visit)->assertOk();
        $note = $this->noteOf($visit);
        $v1 = $note->versions->first()->getAttributes();

        $fixed = ['O' => 'Karies 17 oklusal.'] + self::SOAP;
        $this->as(self::DOC)->postJson("/api/notes/{$note->id}/corrections", ['reason' => 'Salah nomor gigi 16 -> 17', 'soap' => $fixed])
            ->assertCreated()->assertJsonPath('approval', 'not_needed')->assertJsonPath('version', 2);

        $note = $this->noteOf($visit);
        $this->assertEquals($v1, $note->versions[0]->getAttributes());
        $this->assertSame([$note->versions[0]->id, 'Salah nomor gigi 16 -> 17', 'Karies 17 oklusal.'],
            [$note->versions[1]->supersedes_id, $note->versions[1]->reason, $note->versions[1]->soap()['O']]);
        $c = $this->as(self::DOC)->getJson("/api/patients/{$note->patient_id}/chart")->json('visits');
        $this->assertSame(['digantikan', 'berlaku'], array_column(collect($c)->firstWhere('id', $visit)['notes'][0]['versions'], 'status'));
    }

    public function test_correction_needs_reason(): void
    {
        $visit = $this->draftVisit();
        $this->sign($visit)->assertOk();
        $note = $this->noteOf($visit)->id;
        $this->as(self::DOC)->postJson("/api/notes/$note/corrections", ['soap' => self::SOAP])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->as(self::DOC)->postJson("/api/notes/$note/corrections", ['reason' => 'pendek', 'soap' => self::SOAP])->assertUnprocessable();
        $this->assertCount(1, $this->noteOf($visit)->versions);
    }

    public function test_after_48h_solo_dentist_self_approves_with_reason(): void
    {
        $visit = $this->draftVisit();
        $this->sign($visit)->assertOk();
        $this->travel(49)->hours();
        $note = $this->noteOf($visit)->id;
        $r = $this->as(self::DOC)->postJson("/api/notes/$note/corrections", ['reason' => 'Hasil rontgen menunjukkan karies dalam', 'soap' => self::SOAP])
            ->assertCreated()->assertJsonPath('approval', 'self');
        $req = $this->inA(fn () => CorrectionRequest::findOrFail($r->json('correction_request_id')));
        $me = $this->user(self::DOC)->id;
        $this->assertSame(['disetujui', true, $me, 'Hasil rontgen menunjukkan karies dalam'], [$req->state, $req->self_approved, $req->approved_by, $req->approval_reason]);
        $this->assertSame($req->id, $this->noteOf($visit)->versions[1]->correction_request_id);
    }

    public function test_after_48h_multi_dentist_needs_owner_approval(): void
    {
        $this->addSecondDentist();
        $visit = $this->draftVisit();
        $this->sign($visit)->assertOk();
        $this->travel(49)->hours();
        $note = $this->noteOf($visit)->id;
        $body = ['reason' => 'Diagnosis diperbarui setelah rontgen', 'soap' => ['S' => 'Koreksi'] + self::SOAP];
        $req = $this->as(self::DOC)->postJson("/api/notes/$note/corrections", $body)->assertStatus(202)->assertJsonPath('approval', 'pending')
            ->json('correction_request_id');
        $this->assertCount(1, $this->noteOf($visit)->versions); // not current before approval
        $this->as(self::DOC)->postJson("/api/notes/$note/corrections", $body)->assertStatus(409)->assertJsonPath('error', 'correction_pending');
        $this->as(self::DOC)->postJson("/api/correction-requests/$req/approve")->assertForbidden(); // dentist is not owner

        $this->as('pemilik@senyum.test')->postJson("/api/correction-requests/$req/approve")->assertOk()->assertJsonPath('version', 2);
        $v = $this->noteOf($visit)->versions;
        $this->assertSame(['Koreksi', $this->user(self::DOC)->id, $req], [$v[1]->soap()['S'], $v[1]->signed_by, $v[1]->correction_request_id]);
        $this->assertSame($this->user('pemilik@senyum.test')->id, $this->inA(fn () => CorrectionRequest::find($req)->approved_by));
        $this->as('pemilik@senyum.test')->postJson("/api/correction-requests/$req/approve")->assertStatus(409);
    }

    public function test_cross_tenant_chart_is_404(): void
    {
        $p = $this->patientOf($this->tenantA());
        $this->as('dokter@ceria.test')->getJson("/api/patients/{$p->id}/chart")->assertNotFound();
        $visit = $this->inA(fn () => Visit::firstOrFail()->id);
        $this->as('dokter@ceria.test')->putJson("/api/visits/$visit/note", ['soap' => self::SOAP])->assertNotFound();
    }

    public function test_content_hash_is_canonical_and_stable(): void
    {
        $shuffled = ['P' => ['text' => 'Tumpatan', 'codes' => ['23.2']], 'A' => ['text' => 'Karies dentin', 'codes' => ['K02.1']], 'O' => 'Karies 16 oklusal.', 'S' => 'Ngilu gigi 16.'];
        $this->assertSame(Soap::hash(self::SOAP), Soap::hash(Soap::normalize($shuffled)));
        $this->assertSame(hash('sha256', '{"A":{"codes":[],"text":""},"O":"","P":{"codes":[],"text":""},"S":"é/ü"}'), Soap::hash(Soap::normalize(['S' => 'é/ü'])));
        $visit = $this->draftVisit();
        $this->sign($visit)->assertOk();
        $v = $this->noteOf($visit)->versions->first();
        $this->assertSame(Soap::hash($v->soap()), $v->content_hash);
    }

    public function test_invalid_findings_are_422(): void
    {
        $visit = $this->draftVisit();
        foreach ([
            ['tooth' => 11, 'surface' => 'O', 'condition' => 'karies'],  // O on incisor
            ['tooth' => 46, 'surface' => 'I', 'condition' => 'karies'],  // I on molar
            ['tooth' => 46, 'surface' => 'O', 'condition' => 'bolong'],  // unknown condition
            ['tooth' => 19, 'surface' => 'O', 'condition' => 'karies'],  // not FDI
            ['tooth' => 56, 'surface' => 'O', 'condition' => 'karies'],  // primary only to 55
            ['tooth' => 46, 'surface' => 'P', 'condition' => 'karies'],  // P is UI label only
            ['tooth' => 46, 'surface' => 'O', 'condition' => 'hilang'],  // whole-tooth condition with a surface
            ['tooth' => 46, 'surface' => null, 'condition' => 'karies'], // surface condition without surface
        ] as $body) {
            $this->as(self::DOC)->postJson("/api/visits/$visit/findings", $body)->assertUnprocessable();
        }
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 85, 'surface' => 'O', 'condition' => 'karies'])->assertCreated();
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 53, 'surface' => 'I', 'condition' => 'karies'])->assertCreated();
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => ['A' => ['codes' => ['karies']]]])->assertUnprocessable();
    }

    public function test_draft_findings_editable_only_by_author(): void
    {
        $visit = $this->inA(fn () => Visit::whereNotNull('appointment_id')->firstOrFail()->id); // seeded draft, Kemang
        $f = $this->as('asisten@senyum.test')->postJson("/api/visits/$visit/findings", ['tooth' => 36, 'surface' => 'O', 'condition' => 'karies'])
            ->assertCreated()->json('id');
        // re-picking the same surface updates the author's own draft
        $this->as('asisten@senyum.test')->postJson("/api/visits/$visit/findings", ['tooth' => 36, 'surface' => 'O', 'condition' => 'tambalan'])
            ->assertOk()->assertJsonPath('id', $f);
        $this->as(self::DOC)->patchJson("/api/findings/$f", ['condition' => 'karies'])->assertForbidden();
        $this->as(self::DOC)->deleteJson("/api/findings/$f")->assertForbidden();
        $this->as('asisten@senyum.test')->patchJson("/api/findings/$f", ['condition' => 'hilang'])->assertUnprocessable();
        $this->as('asisten@senyum.test')->patchJson("/api/findings/$f", ['condition' => 'sehat'])->assertOk()->assertJsonPath('condition', 'sehat');
        $this->as('asisten@senyum.test')->deleteJson("/api/findings/$f")->assertNoContent();
        $this->as('asisten@senyum.test')->deleteJson("/api/findings/$f")->assertNotFound();

        // chart: my drafts only; sign summary (visit.draft_findings) shows every author's drafts
        $patient = $this->noteOf($visit)->patient_id;
        $c = $this->as(self::DOC)->getJson("/api/patients/$patient/chart")->assertOk();
        $this->assertCount(1, $c->json('drafts')); // 26 karies; the 11 filling is a procedure draft now
        $this->assertCount(1, $c->json('procedure_drafts'));
        $this->assertCount(0, $this->as('asisten@senyum.test')->getJson("/api/patients/$patient/chart")->json('drafts'));
    }

    public function test_soap_codes_must_be_in_official_list(): void
    {
        // K02.0 invalidated, committed on a separate admin connection so ehr_app sees it; restored in finally.
        // Done before any ehr_app read: its REPEATABLE READ snapshot starts at the first read of the test transaction.
        config(['database.connections.icd_tmp' => config('database.connections.mysql_admin')]);
        $tmp = DB::connection('icd_tmp');
        $tmp->table('icd10_codes')->where('code', 'K02.0')->update(['valid' => false]);
        try {
            $visit = $this->draftVisit(); // K02.1 + 23.2 accepted
            $put = fn (array $a, array $p = ['23.2']) => $this->as(self::DOC)->putJson("/api/visits/$visit/note",
                ['revision' => 1, 'soap' => ['A' => ['codes' => $a, 'text' => 'x'], 'P' => ['codes' => $p, 'text' => 'y']] + self::SOAP]);
            foreach (['K02.5', 'K02.7', 'K02.0', 'k02.1'] as $bad) { // not in 2010 list, well-formed unknown, invalidated, wrong case
                $put(['K02.1', $bad])->assertUnprocessable()->assertJsonValidationErrors('soap.A.codes.1');
            }
            $put(['K02.5'])->assertJsonPath('errors', ['soap.A.codes.0' => ['Kode K02.5 tidak ada di daftar resmi SATUSEHAT ICD-10 2010.']]);
            $put(['K02.1'], ['23.99'])->assertUnprocessable()->assertJsonValidationErrors('soap.P.codes.0');
            $put(['K02.1'], ['23.19', '23.01'])->assertOk();

            $this->sign($visit, ['revision' => 2])->assertOk();
            $note = $this->noteOf($visit)->id;
            $fix = fn (array $a) => $this->as(self::DOC)->postJson("/api/notes/$note/corrections",
                ['reason' => 'Koreksi kode diagnosis (uji)', 'soap' => ['A' => ['codes' => $a, 'text' => 'x']] + self::SOAP]);
            $fix(['K02.5'])->assertUnprocessable()->assertJsonValidationErrors('soap.A.codes.0');
            $fix(['K02.0'])->assertUnprocessable()->assertJsonValidationErrors('soap.A.codes.0');
            $fix(['K02.1'])->assertCreated();
        } finally {
            $tmp->table('icd10_codes')->where('code', 'K02.0')->update(['valid' => true]);
            DB::purge('icd_tmp');
        }
        $this->assertTrue(Icd10Code::on('mysql_admin')->findOrFail('K02.0')->valid);
    }

    public function test_procedure_code_must_be_in_official_list(): void
    {
        $visit = $this->draftVisit();
        $post = fn (int $tooth, ?string $code, array $x = []) => $this->as(self::DOC)->postJson("/api/visits/$visit/procedures",
            ['tooth' => $tooth, 'status' => 'direncanakan', 'procedure_code' => $code] + $x);
        $post(48, '23.19')->assertCreated()->assertJsonPath('procedure_code', '23.19')->assertJsonPath('treat_area', 'tooth');
        $post(85, '23.01')->assertCreated()->assertJsonPath('procedure_code', '23.01');
        $post(47, null, ['treat_area' => 'tooth'])->assertCreated()->assertJsonPath('paint_type', 'Text'); // no code: client gives the area
        $post(46, '23.99')->assertUnprocessable()->assertJsonValidationErrors('procedure_code');
        $p = $post(45, '23.09')->assertCreated()->json('id');
        $this->as(self::DOC)->patchJson("/api/procedures/$p", ['procedure_code' => '23.8'])->assertUnprocessable()->assertJsonValidationErrors('procedure_code');
        // findings no longer carry treatments: clear 422 pointing at the procedure API
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 45, 'surface' => null, 'condition' => 'perlu_dicabut', 'procedure_code' => '23.09'])
            ->assertUnprocessable()->assertJsonValidationErrors('procedure_code')
            ->assertJsonPath('errors.procedure_code.0', 'Tindakan dicatat lewat POST /api/visits/{id}/procedures, bukan sebagai temuan.');
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 45, 'surface' => null, 'condition' => 'perlu_dicabut', 'status' => 'selesai'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_finding_diagnosis_code_is_official_icd10(): void
    {
        $visit = $this->draftVisit();
        $post = fn (array $extra) => $this->as(self::DOC)->postJson("/api/visits/$visit/findings",
            ['tooth' => 46, 'surface' => 'O', 'condition' => 'karies'] + $extra);
        $f = $post(['diagnosis_code' => 'K02.1'])->assertCreated()
            ->assertJsonPath('diagnosis_code', 'K02.1')->assertJsonPath('diagnosis_source', 'manual')->json('id');
        foreach (['K02.5', 'K02.7', 'k02.1', '23.2'] as $bad) { // not in 2010 list, unknown, wrong case, ICD-9-CM
            $post(['diagnosis_code' => $bad])->assertUnprocessable()->assertJsonValidationErrors('diagnosis_code');
        }
        $post(['diagnosis_code' => 'K02.5'])->assertJsonPath('errors', ['diagnosis_code' => ['Kode K02.5 tidak ada di daftar resmi SATUSEHAT ICD-10 2010.']]);
        $post(['diagnosis_code' => 'K02.1', 'diagnosis_source' => 'tebak'])->assertUnprocessable()->assertJsonValidationErrors('diagnosis_source');

        $patch = fn (array $body) => $this->as(self::DOC)->patchJson("/api/findings/$f", ['condition' => 'karies'] + $body);
        $patch([])->assertOk()->assertJsonPath('diagnosis_code', 'K02.1'); // omitted = kept
        $patch(['diagnosis_code' => 'K02.0', 'diagnosis_source' => 'aturan'])->assertOk()->assertJsonPath('diagnosis_source', 'aturan');
        $patch(['diagnosis_code' => 'K02.5'])->assertUnprocessable();
        $patch(['diagnosis_code' => ''])->assertOk()->assertJsonPath('diagnosis_code', null)->assertJsonPath('diagnosis_source', null);
        $patch(['diagnosis_code' => 'K02.1'])->assertOk()->assertJsonPath('diagnosis_source', 'manual');

        $patient = $this->noteOf($visit)->patient_id;
        $draft = collect($this->as(self::DOC)->getJson("/api/patients/$patient/chart")->assertOk()->json('drafts'))->firstWhere('id', $f);
        $this->assertSame(['K02.1', 'manual'], [$draft['diagnosis_code'], $draft['diagnosis_source']]);

        $this->sign($visit)->assertOk(); // signing freezes the finding with its diagnosis
        $this->as(self::DOC)->patchJson("/api/findings/$f", ['condition' => 'karies', 'diagnosis_code' => 'K02.0'])->assertStatus(409);
        $final = collect($this->as(self::DOC)->getJson("/api/patients/$patient/chart")->json('findings'))->firstWhere('id', $f);
        $this->assertSame(['final', 'K02.1'], [$final['state'], $final['diagnosis_code']]);
    }
}
