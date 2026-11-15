<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\SelesaiSignature;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Integrations\Models\Outbox;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

// DEVIATIONS #54 (Yohanes, 15 Nov 2026): Selesai = tanda tangan elektronik (tidak tersertifikasi) + tutup kunjungan, one idempotent action.
class SelesaiSignatureTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private const SOAP = ['S' => 'Ngilu gigi 16.', 'O' => 'Karies 16 oklusal.', 'A' => ['codes' => ['K02.1'], 'text' => 'Karies dentin'],
        'P' => ['codes' => ['23.2'], 'text' => 'Tumpatan']];

    private const ATTESTATION = 'Dengan menekan Selesai, saya menyatakan catatan ini benar.';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** Fresh visit with a draft note + one billed `selesai` filling (seeded tariff 23.2). @return array{0: string, 1: string} [visit, procedure] */
    private function visit(array $note = []): array
    {
        $appt = $this->inA(fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => self::SOAP] + $note)->assertOk();
        $proc = $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated()->json('id');

        return [$visit, $proc];
    }

    private function selesai(string $visit, array $body = [], string $email = self::DOC)
    {
        return $this->as($email)->postJson("/api/visits/$visit/selesai", $body + ['revision' => 1, 'confirm' => true]);
    }

    private function version(string $visit): ClinicalNoteVersion
    {
        return $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->firstOrFail()->versions->first());
    }

    private function audits(string $action): int
    {
        return $this->inA(fn () => AuditEvent::where('action', $action)->count());
    }

    public function test_only_the_dpjp_may_press_selesai(): void
    {
        [$visit] = $this->visit();
        foreach (['asisten@senyum.test', 'depan@senyum.test', self::OWNER] as $email) {
            $this->selesai($visit, email: $email)->assertForbidden();
        }
        $doc2 = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Kedua Contoh', 'dokter_gigi');
        $this->inA(fn () => Membership::create(['user_id' => $doc2->id, 'role' => 'dentist']));
        $this->selesai($visit, email: $doc2->email)->assertForbidden(); // a dentist, but not this visit's DPJP
        $this->as($doc2->email)->postJson("/api/visits/$visit/approve-drafts")->assertForbidden();
        $this->assertSame('draft', $this->version($visit)->state);

        $r = $this->selesai($visit, ['attestation_text' => 'Teks dari klien'])->assertOk()
            ->assertJsonPath('signed_by', $this->user(self::DOC)->id)->assertJsonPath('visit.status', 'selesai')
            ->assertJsonPath('attestation.version', 1)->assertJsonPath('attestation.text', self::ATTESTATION)->assertJsonPath('valid', true);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $r->json('signature_hash'));
        $this->assertSame(self::ATTESTATION, $this->version($visit)->attestation_text); // server wording, not the client's
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tanda_tangan')->where('entity_id', $r->json('version_id'))->exists()));
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tutup')->where('entity_id', $visit)->exists()));
    }

    public function test_signature_hash_recomputes_from_stored_rows_and_detects_tampering(): void
    {
        [$visit, $proc] = $this->visit();
        $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => 26, 'surface' => 'O', 'condition' => 'karies',
            'diagnosis_code' => 'K02.0'])->assertCreated();
        $hash = $this->selesai($visit)->assertOk()->json('signature_hash');
        $v = $this->version($visit);
        $this->assertSame($hash, $v->signature_hash);

        $rows = $this->inA(fn () => ProcedureRecord::where('visit_id', $visit)->get()->map->getAttributes()->all());
        $canonical = SelesaiSignature::canonical($visit, $v->soap(), $rows, ['K02.0']);
        $this->assertSame($hash, SelesaiSignature::hash($canonical));
        $this->assertSame($hash, $this->inA(fn () => SelesaiSignature::recompute($visit, $v->soap(), $v->signed_at)));
        $this->assertSame(['K02.0', 'K02.1'], json_decode($canonical, true)['diagnoses']);
        $this->assertStringContainsString('"procedures":[{"arch":null,"diagnosis_code":"K02.1","id":"'.$proc.'"', $canonical); // sorted keys

        // tamper detection: any change in SOAP, a procedure or a diagnosis gives another hash
        $tampered = [
            SelesaiSignature::canonical($visit, ['O' => 'Karies 17 oklusal.'] + $v->soap(), $rows, ['K02.0']),
            SelesaiSignature::canonical($visit, $v->soap(), [['procedure_code' => '23.3'] + $rows[0]], ['K02.0']),
            SelesaiSignature::canonical($visit, $v->soap(), [['tooth' => 17] + $rows[0]], ['K02.0']),
            SelesaiSignature::canonical($visit, $v->soap(), $rows, ['K02.0', 'K04.0']),
            SelesaiSignature::canonical($visit, $v->soap(), [], ['K02.0']),
        ];
        foreach ($tampered as $i => $c) {
            $this->assertNotSame($hash, SelesaiSignature::hash($c), "mutation $i");
        }
        // a later correction is history, not part of what was signed: the signature stays valid
        $this->as(self::DOC)->postJson("/api/procedures/$proc/corrections", ['reason_type' => 'salah_kode', 'reason' => 'Salah kode tindakan (uji).',
            'procedure_code' => '23.3'])->assertCreated();
        $this->as('asisten@senyum.test')->getJson("/api/visits/$visit/signature")->assertOk()->assertJsonPath('valid', true)
            ->assertJsonPath('signature_hash', $hash)->assertJsonPath('signed_by', $this->user(self::DOC)->id)
            ->assertJsonPath('attestation.text', self::ATTESTATION);
        $this->as('depan@senyum.test')->getJson("/api/visits/$visit/signature")->assertForbidden(); // no note.read
    }

    public function test_note_and_drafts_are_locked_after_selesai(): void
    {
        [$visit, $proc] = $this->visit();
        $this->selesai($visit)->assertOk()->assertJsonPath('procedures_locked', 1);
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => self::SOAP])->assertStatus(409)->assertJsonPath('error', 'signed');
        $this->as(self::DOC)->patchJson("/api/procedures/$proc", ['surfaces' => 'MO'])->assertStatus(409);
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 17, 'surfaces' => 'O', 'procedure_code' => '23.2',
            'status' => 'selesai'])->assertStatus(409);
        $this->assertSame('final', $this->inA(fn () => ProcedureRecord::findOrFail($proc)->state));
        $note = $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->value('id'));
        $this->as(self::DOC)->postJson("/api/notes/$note/corrections", ['reason' => 'Tambahan keterangan (uji).', 'soap' => self::SOAP])
            ->assertCreated()->assertJsonPath('version', 2); // changes only as a new version
    }

    public function test_unapproved_agent_drafts_block_selesai_until_setujui(): void
    {
        [$visit, $manual] = $this->visit(['source' => 'ai_draft']);
        $ai = $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 17, 'surfaces' => 'O', 'procedure_code' => '23.2',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1', 'source' => 'ai_draft'])->assertCreated()->json('id');
        $version = $this->version($visit)->id;
        $this->selesai($visit)->assertUnprocessable()->assertJsonPath('error', 'unapproved_drafts')
            ->assertJsonPath('note_version_ids', [$version])->assertJsonPath('procedure_ids', [$ai])->assertJsonPath('finding_ids', []);
        $this->as('asisten@senyum.test')->postJson("/api/visits/$visit/approve-drafts")->assertForbidden(); // no note.sign

        $this->as(self::DOC)->postJson("/api/visits/$visit/approve-drafts", ['ids' => [$ai]])->assertOk()
            ->assertJsonPath('pending.procedure_ids', [])->assertJsonPath('pending.note_version_ids', [$version]);
        // editing an approved agent draft needs a new Setujui
        $this->as(self::DOC)->patchJson("/api/procedures/$ai", ['surfaces' => 'MO'])->assertOk();
        $this->selesai($visit)->assertUnprocessable()->assertJsonPath('procedure_ids', [$ai])->assertJsonPath('note_version_ids', [$version]);

        $this->as(self::DOC)->postJson("/api/visits/$visit/approve-drafts")->assertOk()->assertJsonPath('approved.procedures', 1)
            ->assertJsonPath('approved.note_versions', 1);
        $this->selesai($visit)->assertOk();
        $row = $this->inA(fn () => ProcedureRecord::findOrFail($ai));
        $this->assertSame(['final', 'ai_draft', $this->user(self::DOC)->id], [$row->state, $row->source, $row->approved_by]);
        $this->assertSame('manual', $this->inA(fn () => ProcedureRecord::findOrFail($manual)->source));
        $this->assertSame(2, $this->audits('setujui_draf_ai'));
    }

    public function test_pin_is_off_by_default(): void
    {
        $this->as(self::DOC)->getJson('/api/me')->assertOk()->assertJsonPath('selesai', ['pin_required' => false, 'has_pin' => false]);
        $this->as(self::OWNER)->getJson('/api/settings/clinic')->assertOk()->assertJsonPath('selesai_pin_required', false);
        $this->as('dokter@ceria.test')->getJson('/api/settings/clinic')->assertOk()->assertJsonPath('selesai_pin_required', false);
        [$visit] = $this->visit();
        $this->selesai($visit)->assertOk();
    }

    public function test_pin_required_wrong_pin_lockout_and_audit(): void
    {
        foreach ([self::DOC, 'asisten@senyum.test'] as $who) {
            $this->as($who)->putJson('/api/settings/clinic', ['selesai_pin_required' => true])->assertForbidden();
        }
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['selesai_pin_required' => true])->assertOk()
            ->assertJsonPath('selesai_pin_required', true)->assertJsonPath('correction_window_hours', 48);
        $audit = $this->inA(fn () => AuditEvent::where('action', 'ubah_pengaturan')->sole()->detail);
        $this->assertEquals(['field' => 'selesai_pin_required', 'from' => false, 'to' => true], $audit);
        $this->as('dokter@ceria.test')->getJson('/api/me')->assertJsonPath('selesai.pin_required', false); // per clinic

        [$visit] = $this->visit();
        $this->selesai($visit)->assertUnprocessable()->assertJsonPath('error', 'pin_not_set');

        foreach (['12345', 'abcdef', '1234567'] as $bad) {
            $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => $bad])->assertUnprocessable()->assertJsonValidationErrors('pin');
        }
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '246810'])->assertOk()->assertJsonPath('has_pin', true);
        $me = $this->as(self::DOC)->getJson('/api/me')->assertJsonPath('selesai', ['pin_required' => true, 'has_pin' => true]);
        $this->assertStringNotContainsString('selesai_pin_hash', $me->getContent());

        // successful Selesai resets the counter: two wrong, then right
        $this->selesai($visit, ['pin' => '000000'])->assertForbidden()->assertJsonPath('error', 'pin_wrong');
        $this->selesai($visit)->assertForbidden(); // missing PIN
        $this->assertSame(2, $this->user(self::DOC)->fresh()->selesai_pin_failures);
        $this->assertSame('draft', $this->version($visit)->state);
        $this->selesai($visit, ['pin' => '246810'])->assertOk();
        $this->assertSame(0, $this->user(self::DOC)->fresh()->selesai_pin_failures);

        // 5 consecutive failures lock for 15 minutes, even for the right PIN
        $this->travel(1)->minutes(); // next HTTP throttle window: this checks the PIN lockout itself
        [$visit2] = $this->visit();
        foreach (range(1, 4) as $i) {
            $this->selesai($visit2, ['pin' => '11111'.$i])->assertForbidden()->assertJsonPath('error', 'pin_wrong');
        }
        $this->selesai($visit2, ['pin' => '111115'])->assertForbidden()->assertJsonPath('error', 'pin_locked');
        $this->selesai($visit2, ['pin' => '246810'])->assertForbidden()->assertJsonPath('error', 'pin_locked');
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '135790', 'current_pin' => '246810'])->assertForbidden(); // locked too
        $this->travel(14)->minutes();
        $this->selesai($visit2, ['pin' => '246810'])->assertForbidden()->assertJsonPath('error', 'pin_locked');
        $this->travel(2)->minutes();
        $this->selesai($visit2, ['pin' => '246810'])->assertOk();
        $this->assertSame('selesai', $this->inA(fn () => Visit::findOrFail($visit2)->status));

        $this->assertSame(7, $this->audits('pin_gagal'));
        $this->assertSame(1, $this->audits('pin_terkunci'));
        $logged = $this->inA(fn () => AuditEvent::whereIn('action', ['pin_gagal', 'pin_terkunci', 'pin_diatur'])->get()->toJson());
        $this->assertStringNotContainsString('246810', $logged);
        $this->assertStringNotContainsString('11111', $logged);
    }

    public function test_change_pin_needs_the_current_pin(): void
    {
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '246810'])->assertOk();
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '135790'])->assertForbidden();
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '135790', 'current_pin' => '999999'])->assertForbidden();
        $this->as(self::DOC)->putJson('/api/me/selesai-pin', ['pin' => '135790', 'current_pin' => '246810'])->assertOk();
        $this->assertSame([1, 1], [$this->audits('pin_diatur'), $this->audits('pin_diubah')]);
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['selesai_pin_required' => true])->assertOk();
        [$visit] = $this->visit();
        $this->selesai($visit, ['pin' => '246810'])->assertForbidden();
        $this->selesai($visit, ['pin' => '135790'])->assertOk();
    }

    public function test_double_press_is_idempotent(): void
    {
        [$visit] = $this->visit();
        $first = $this->selesai($visit)->assertOk()->json();
        $this->travel(5)->minutes();
        $second = $this->selesai($visit)->assertOk()->json();
        foreach (['version_id', 'signed_by', 'signed_at', 'signature_hash', 'attestation'] as $k) {
            $this->assertSame($first[$k], $second[$k], $k);
        }
        $this->assertSame('selesai', $second['visit']['status']);
        $this->assertCount(1, $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get()));
        $this->assertSame(1, $this->inA(fn () => Outbox::where('idempotency_key', "satusehat:note_version:{$first['version_id']}")->count()));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('action', 'tanda_tangan')->where('entity_id', $first['version_id'])->count()));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('action', 'tutup')->where('entity_id', $visit)->count()));
        $this->selesai($visit, ['confirm' => false])->assertForbidden(); // still a deliberate press
    }

    public function test_selesai_runs_signcheck_and_revision_before_signing(): void
    {
        [$visit] = $this->visit();
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['revision' => 1, 'soap' => self::SOAP])->assertOk();
        $this->selesai($visit)->assertStatus(409)->assertJsonPath('error', 'stale');
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 36, 'procedure_code' => '23.01', 'status' => 'selesai',
            'diagnosis_code' => 'K04.1'])->assertCreated();
        $this->selesai($visit, ['revision' => 2])->assertUnprocessable()->assertJsonPath('error', 'sign_blocked');
        $this->assertSame('draft', $this->version($visit)->state);
    }

    public function test_other_tenant_gets_404(): void
    {
        [$visit] = $this->visit();
        $this->selesai($visit, email: 'dokter@ceria.test')->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/visits/$visit/approve-drafts")->assertNotFound();
        $this->selesai($visit)->assertOk();
        $this->as('dokter@ceria.test')->getJson("/api/visits/$visit/signature")->assertNotFound();
        $this->assertSame('signed', $this->version($visit)->state);
    }
}
