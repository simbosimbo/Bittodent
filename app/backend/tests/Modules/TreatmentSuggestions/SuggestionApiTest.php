<?php

namespace Tests\Modules\TreatmentSuggestions;

use App\Modules\Agents\Models\AgentDraft;
use App\Modules\Agents\Models\AgentRun;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Integrations\Models\Outbox;
use App\Modules\Patients\Models\Patient;
use App\Modules\TreatmentSuggestions\Models\TreatmentRule;
use App\Shared\Audit\AuditEvent;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// A2 end to end: GET stores cited drafts once (deterministic run), approve = draft plan item only, approve-all idempotent,
// reject = feedback, dentist only, tenant wall, rules versioned and limited to tariff codes.
class SuggestionApiTest extends TestCase
{
    private const DOKTER = 'dokter@senyum.test';

    /** Patient without visits in tenant A: old signed visit with findings + an open visit today. @return array{patient: string, visit: string, f: array<string, string>} */
    private function fixture(bool $withFindings = true): array
    {
        return Ctx::runAs($this->tenantA()->id, function () use ($withFindings) {
            $dentist = $this->user(self::DOKTER)->id;
            $patient = Patient::whereNotIn('id', Visit::select('patient_id'))->orderBy('created_at')->firstOrFail();
            $branch = Visit::firstOrFail()->branch_id;
            $mk = fn (int $days, string $status) => Visit::create(['patient_id' => $patient->id, 'branch_id' => $branch, 'dentist_id' => $dentist,
                'started_at' => now()->subDays($days), 'status' => $status]);
            $old = $mk(30, 'selesai');
            $open = $mk(0, 'berlangsung');
            $f = [];
            if ($withFindings) {
                $add = function (string $k, int $tooth, ?string $surface, string $cond, string $status = 'kondisi_pantau', ?string $code = null) use (&$f, $patient, $old, $dentist) {
                    $f[$k] = ToothFinding::create([
                        'patient_id' => $patient->id, 'visit_id' => $old->id, 'tooth' => $tooth, 'surface' => $surface, 'condition' => $cond,
                        'status' => $status, 'procedure_code' => $code, 'state' => 'final', 'source' => 'manual', 'created_by' => $dentist,
                        'finalized_by' => $dentist, 'finalized_at' => $old->started_at])->id;
                };
                $add('26O', 26, 'O', 'karies');
                $add('26M', 26, 'M', 'karies');
                $add('g18', 18, null, 'sisa_akar');
                $add('11I', 11, 'I', 'tambalan');                                 // no rule
                $add('36O', 36, 'O', 'karies', 'direncanakan', '23.2');           // already planned
                $add('47O', 47, 'O', 'karies');
                $add('47D', 47, 'D', 'tambalan', 'direncanakan', '23.2');         // same procedure already planned on 47
            }

            return ['patient' => $patient->id, 'visit' => $open->id, 'old' => $old->id, 'f' => $f];
        }, $this->user(self::DOKTER)->id);
    }

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn, $this->user(self::DOKTER)->id);
    }

    private function counts(): array
    {
        return $this->inA(fn () => ['notes' => ClinicalNote::count(), 'versions' => ClinicalNoteVersion::count(), 'signed' => ClinicalNoteVersion::where('state', 'signed')->count(),
            'final_findings' => ToothFinding::where('state', 'final')->count(), 'outbox' => Outbox::count()]);
    }

    public function test_dentist_gets_cited_suggestions_only_from_recorded_findings_stored_once(): void
    {
        $x = $this->fixture();
        $r = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertOk()
            ->assertJsonPath('locked', false)->assertJsonPath('counts', ['draf' => 2, 'disetujui' => 0, 'ditolak' => 0]);
        $items = $r->json('items');

        $this->assertSame([[18, [], '23.09', 'sisa_akar'], [26, ['M', 'O'], '23.2', 'karies']],
            array_map(fn ($i) => [$i['tooth'], $i['surfaces'], $i['procedure_code'], $i['condition']], $items));
        $this->assertSame([[$x['f']['g18'], 1]], array_map(fn ($c) => [$c['id'], $c['version']], $items[0]['citations']));
        $this->assertSame([$x['f']['26M'], $x['f']['26O']], array_column($items[1]['citations'], 'id'));
        $this->assertSame('Pencabutan gigi (contoh)', $items[0]['procedure_name']);
        $this->assertArrayNotHasKey('price_rp', $items[0]);
        $this->assertStringNotContainsString('price', $r->getContent());

        $this->inA(function () use ($x) {
            $run = AgentRun::sole();
            $this->assertSame(['saran_tindakan', 'deterministik', 'lokal', 'id-lokal', 'berhasil', $x['patient']],
                [$run->agent, $run->generator, $run->provider, $run->region, $run->outcome, $run->patient_id]);
            $this->assertEqualsCanonicalizing([$x['f']['g18'], $x['f']['26M'], $x['f']['26O']],
                array_column(array_filter($run->input_refs, fn ($r) => $r['type'] === 'finding'), 'id'));
            $this->assertSame(2, AgentDraft::where('kind', 'saran_tindakan')->where('target_id', $x['visit'])->count());
            $this->assertSame(1, AuditEvent::where('action', 'ai_panggil')->where('entity_id', $run->id)->count());
        });

        // same findings => nothing new stored
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertOk()->assertJsonCount(2, 'items');
        $this->inA(fn () => $this->assertSame([1, 2], [AgentRun::count(), AgentDraft::count()]));
    }

    public function test_no_findings_means_no_suggestions_and_no_run(): void
    {
        $x = $this->fixture(false);
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertOk()->assertJsonPath('items', []);
        $this->inA(fn () => $this->assertSame([0, 0], [AgentRun::count(), AgentDraft::count()]));
    }

    public function test_approve_only_adds_a_draft_plan_item_never_a_note_or_signature(): void
    {
        $x = $this->fixture();
        $items = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items');
        $before = $this->counts();

        $r = $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[1]['id']}/approve")->assertOk()->assertJsonPath('state', 'disetujui');
        $this->assertCount(2, $r->json('plan_item_ids'));

        $this->assertSame($before, $this->counts());
        $this->inA(function () use ($x, $items) {
            $rows = ToothFinding::where('visit_id', $x['visit'])->orderBy('surface')->get();
            $this->assertSame([['M', 'draft', 'ai_draft', 'direncanakan', 'karies', '23.2'], ['O', 'draft', 'ai_draft', 'direncanakan', 'karies', null]],
                $rows->map(fn ($f) => [$f->surface, $f->state, $f->source, $f->status, $f->condition, $f->procedure_code])->all()); // billed once
            $this->assertSame('disetujui', AgentDraft::findOrFail($items[1]['id'])->state->value);
        });

        // planned now => not suggested again; the approved item stays listed as disetujui
        $after = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json();
        $this->assertSame(['draf' => 1, 'disetujui' => 1, 'ditolak' => 0], $after['counts']);
        $this->inA(fn () => $this->assertSame(1, AgentRun::count()));
        // approving twice is refused
        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[1]['id']}/approve")->assertStatus(409)->assertJsonPath('error', 'wrong_state');
    }

    public function test_approve_all_is_idempotent(): void
    {
        $x = $this->fixture();
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertOk();

        $first = $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/treatment-suggestions/approve-all")->assertOk();
        $this->assertCount(2, $first->json('approved'));
        $this->assertSame(['draf' => 0, 'disetujui' => 2, 'ditolak' => 0], $first->json('counts'));
        $rows = $this->inA(fn () => ToothFinding::where('visit_id', $x['visit'])->count());
        $this->assertSame(3, $rows); // 18 whole tooth + 26 M + 26 O

        $second = $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/treatment-suggestions/approve-all")->assertOk();
        $this->assertSame([], $second->json('approved'));
        $this->assertSame($rows, $this->inA(fn () => ToothFinding::where('visit_id', $x['visit'])->count()));
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertJsonPath('counts.disetujui', 2);
        $this->inA(fn () => $this->assertSame(1, AgentRun::count()));
    }

    public function test_reject_is_recorded_as_feedback_and_not_suggested_again(): void
    {
        $x = $this->fixture();
        $items = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items');
        $before = $this->counts();

        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[0]['id']}/reject", ['reason' => 'pasien_menolak'])->assertOk()->assertJsonPath('state', 'ditolak');
        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[1]['id']}/reject")->assertOk(); // one tap
        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[1]['id']}/reject", ['reason' => 'karangan'])->assertStatus(422);

        $this->inA(function () use ($items) {
            $this->assertSame('pasien_menolak', Crypto::decrypt(AgentDraft::findOrFail($items[0]['id'])->reject_reason_enc));
            $this->assertSame('tidak_perlu', Crypto::decrypt(AgentDraft::findOrFail($items[1]['id'])->reject_reason_enc));
            $this->assertSame(2, AuditEvent::where('action', 'ai_draf_tolak')->count());
        });
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertJsonPath('counts', ['draf' => 0, 'disetujui' => 0, 'ditolak' => 2]);
        $this->assertSame($before, $this->counts());
        $this->inA(fn () => $this->assertSame([0, 1], [ToothFinding::where('visit_id', $x['visit'])->count(), AgentRun::count()]));
    }

    public function test_changed_source_finding_makes_the_old_suggestion_stale(): void
    {
        $x = $this->fixture();
        $items = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items');
        // 18 gets a signed plan through the normal status change (new final row superseding the cited one)
        $this->as(self::DOKTER)->postJson("/api/findings/{$x['f']['g18']}/status", ['to' => 'direncanakan', 'visit_id' => $x['old']])->assertCreated();

        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[0]['id']}/approve")->assertStatus(409)->assertJsonPath('error', 'stale');
        $this->inA(fn () => $this->assertSame([0, 'menunggu_review'], [ToothFinding::where('visit_id', $x['visit'])->count(), AgentDraft::findOrFail($items[0]['id'])->state->value]));
        // the next GET retires it
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertJsonPath('counts.draf', 1);
        $this->inA(fn () => $this->assertSame('digantikan', AgentDraft::findOrFail($items[0]['id'])->state->value));
    }

    public function test_signed_visit_is_read_only(): void
    {
        $x = $this->fixture();
        $items = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items');
        $this->inA(function () use ($x) {
            $n = ClinicalNote::create(['visit_id' => $x['visit'], 'patient_id' => $x['patient'], 'author_id' => $this->user(self::DOKTER)->id, 'first_input_at' => now()]);
            DB::table('clinical_note_version')->insert(['tenant_id' => $this->tenantA()->id, 'id' => (string) Str::uuid7(), 'note_id' => $n->id,
                'version' => 1, 'revision' => 1, 'state' => 'signed', 'source' => 'manual', 'soap_enc' => Crypto::encrypt('{}'), 'content_hash' => str_repeat('0', 64),
                'created_by' => $this->user(self::DOKTER)->id, 'signed_by' => $this->user(self::DOKTER)->id, 'signed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        });
        $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertOk()->assertJsonPath('locked', true);
        $this->as(self::DOKTER)->postJson("/api/treatment-suggestions/{$items[0]['id']}/approve")->assertStatus(409)->assertJsonPath('error', 'visit_closed');
        $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/treatment-suggestions/approve-all")->assertStatus(409);
    }

    public function test_patient_without_open_visit_gets_a_preview_that_stores_nothing(): void
    {
        $x = $this->fixture();
        $this->inA(fn () => Visit::whereKey($x['visit'])->update(['status' => 'selesai']));
        $r = $this->as(self::DOKTER)->getJson("/api/patients/{$x['patient']}/treatment-suggestions")->assertOk()
            ->assertJsonPath('visit_id', null)->assertJsonPath('locked', true)->assertJsonCount(2, 'items');
        $this->assertNull($r->json('items.0.id'));
        $this->inA(fn () => $this->assertSame([0, 0], [AgentRun::count(), AgentDraft::count()]));
    }

    public static function notDentists(): array
    {
        return [['pemilik@senyum.test'], ['asisten@senyum.test'], ['depan@senyum.test'], ['kasir@senyum.test']];
    }

    #[DataProvider('notDentists')]
    public function test_only_dentists_see_and_review_suggestions(string $email): void
    {
        $x = $this->fixture();
        $id = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items.0.id');

        $this->as($email)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertForbidden();
        $this->as($email)->getJson("/api/patients/{$x['patient']}/treatment-suggestions")->assertForbidden();
        $this->as($email)->postJson("/api/treatment-suggestions/$id/approve")->assertForbidden();
        $this->as($email)->postJson("/api/treatment-suggestions/$id/reject")->assertForbidden();
        $this->as($email)->postJson("/api/visits/{$x['visit']}/treatment-suggestions/approve-all")->assertForbidden();
        $this->as($email)->getJson('/api/treatment-rules')->assertForbidden();
        $this->inA(fn () => $this->assertSame(0, ToothFinding::where('visit_id', $x['visit'])->count()));
    }

    public function test_generic_draft_endpoint_cannot_bypass_the_plan_step(): void
    {
        $x = $this->fixture();
        $id = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items.0.id');
        $this->as(self::DOKTER)->postJson("/api/ai-drafts/$id/approve")->assertStatus(409)->assertJsonPath('error', 'own_flow');
        $this->as(self::DOKTER)->postJson("/api/ai-drafts/$id/reject", ['reason' => 'uji generik'])->assertStatus(409);
        $this->inA(fn () => $this->assertSame('menunggu_review', AgentDraft::findOrFail($id)->state->value));
    }

    public function test_other_tenant_sees_nothing(): void
    {
        $x = $this->fixture();
        $id = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items.0.id');

        $this->as('dokter@ceria.test')->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/treatment-suggestions/$id/approve")->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/treatment-suggestions/$id/reject")->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/visits/{$x['visit']}/treatment-suggestions/approve-all")->assertNotFound();
        $this->as('dokter@ceria.test')->getJson("/api/patients/{$x['patient']}/treatment-suggestions")->assertOk()->assertJsonPath('items', []);
        $this->inA(fn () => $this->assertSame('menunggu_review', AgentDraft::findOrFail($id)->state->value));
    }

    public function test_rules_are_versioned_per_clinic_and_only_use_existing_tariff_codes(): void
    {
        $x = $this->fixture();
        $this->as(self::DOKTER)->postJson('/api/treatment-rules', ['rule_key' => 'karies-baru', 'condition' => 'karies', 'procedure_code' => '99.99', 'priority' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('procedure_code');
        $this->as(self::DOKTER)->postJson('/api/treatment-rules', ['rule_key' => 'x-y', 'condition' => 'goyang', 'procedure_code' => '23.2', 'priority' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('condition');
        $this->as(self::DOKTER)->postJson('/api/treatment-rules', ['rule_key' => 'x-y', 'condition' => 'sisa_akar', 'surfaces' => ['O'], 'procedure_code' => '23.09', 'priority' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('surfaces');

        // karies-tumpatan v2: occlusal only => 26-M drops out of the suggestion
        $this->as(self::DOKTER)->postJson('/api/treatment-rules', ['rule_key' => 'karies-tumpatan', 'condition' => 'karies', 'surfaces' => ['O'], 'procedure_code' => '23.2', 'priority' => 20])
            ->assertCreated()->assertJsonPath('version', 2);
        $rules = collect($this->as(self::DOKTER)->getJson('/api/treatment-rules')->assertOk()->json('rules'))->keyBy('rule_key');
        $this->assertSame([2, ['O'], 'Tumpatan (contoh)'], [$rules['karies-tumpatan']['version'], $rules['karies-tumpatan']['surfaces'], $rules['karies-tumpatan']['procedure_name']]);
        $items = $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/treatment-suggestions")->json('items');
        $this->assertSame(['O'], $items[1]['surfaces']);
        $this->assertSame(2, $items[1]['rule']['version']);

        // retire a rule
        $this->as(self::DOKTER)->postJson('/api/treatment-rules', ['rule_key' => 'sisa-akar-cabut', 'condition' => 'sisa_akar', 'procedure_code' => '23.09', 'priority' => 10, 'active' => false])->assertCreated();
        $this->inA(function () {
            $this->assertSame(2, TreatmentRule::where('rule_key', 'sisa-akar-cabut')->count()); // history kept
            try {
                TreatmentRule::where('rule_key', 'karies-tumpatan')->update(['procedure_code' => '23.09']);
                $this->fail('update allowed');
            } catch (QueryException) {
            }
        });
        // tenant B still on its own v1 rules
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertSame(1, TreatmentRule::where('rule_key', 'karies-tumpatan')->max('version')));
    }
}
