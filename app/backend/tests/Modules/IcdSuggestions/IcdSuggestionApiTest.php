<?php

namespace Tests\Modules\IcdSuggestions;

use App\Modules\Agents\Models\AgentDraft;
use App\Modules\Agents\Models\AgentRun;
use App\Modules\Clinical\Contracts\CodingRefused;
use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\Clinical\Contracts\VisitCoding;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelDescriptor;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Models\Outbox;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Modules\Patients\Models\Patient;
use App\Shared\Ai\ClinicAiSetting;
use App\Shared\Audit\AuditEvent;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// A1 end to end: GET stores cited drafts once, approve = code on the DRAFT SOAP only, reject = feedback, dentist only,
// tenant wall, free mode never calls a model, paid mode re-picks among candidates with deterministic fallback.
class IcdSuggestionApiTest extends TestCase
{
    private const DOKTER = 'dokter@senyum.test';

    private const NIK = '9912345678901234';

    private FakeModelClient $fake;

    /** @var list<ModelRequest> */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->fake = new FakeModelClient;
        $spy = new class($this->fake, $this->sent) implements ModelClient
        {
            public function __construct(private FakeModelClient $inner, private array &$sent) {}

            public function descriptor(): ModelDescriptor
            {
                return $this->inner->descriptor();
            }

            public function complete(ModelRequest $request): ModelReply
            {
                $this->sent[] = $request;

                return $this->inner->complete($request);
            }
        };
        $this->app->instance(ModelClient::class, $spy);
    }

    /** Patient without visits in tenant A: old signed visit with findings + an open visit with a SOAP draft. */
    private function fixture(bool $withNote = true): array
    {
        $x = Ctx::runAs($this->tenantA()->id, function () {
            $dentist = $this->user(self::DOKTER)->id;
            $patient = Patient::whereNotIn('id', Visit::select('patient_id'))->orderBy('created_at')->firstOrFail();
            $branch = Visit::firstOrFail()->branch_id;
            $mk = fn (int $days, string $status) => Visit::create(['patient_id' => $patient->id, 'branch_id' => $branch, 'dentist_id' => $dentist,
                'started_at' => now()->subDays($days), 'status' => $status]);
            $old = $mk(30, 'selesai');
            $open = $mk(0, 'berlangsung');
            $f = [];
            foreach ([['36', 36, 'O', 'karies', 'kondisi_pantau', null], ['46', 46, null, 'sisa_akar', 'kondisi_pantau', null],
                ['26', 26, 'O', 'tambalan', 'ada_di_klinik_ini', null], ['47', 47, 'O', 'karies', 'direncanakan', '23.2']] as [$k, $tooth, $s, $c, $st, $code]) {
                $f[$k] = ToothFinding::create(['patient_id' => $patient->id, 'visit_id' => $old->id, 'tooth' => $tooth, 'surface' => $s, 'condition' => $c,
                    'status' => $st, 'procedure_code' => $code, 'state' => 'final', 'source' => 'manual', 'created_by' => $dentist,
                    'finalized_by' => $dentist, 'finalized_at' => $old->started_at])->id;
            }

            return ['patient' => $patient->id, 'name' => $patient->name, 'visit' => $open->id, 'f' => $f];
        }, $this->user(self::DOKTER)->id);
        if ($withNote) {
            $this->as(self::DOKTER)->putJson("/api/visits/{$x['visit']}/note", ['soap' => ['S' => 'Ngilu minum dingin', 'O' => 'Perkusi negatif',
                'A' => ['text' => "Gigi berlubang 36 dalam, sisa akar 46. {$x['name']} NIK ".self::NIK, 'codes' => []],
                'P' => ['text' => 'Rencana cabut 46', 'codes' => []]]])->assertOk();
        }

        return $x;
    }

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn, $this->user(self::DOKTER)->id);
    }

    private function draft(string $visit): array
    {
        return $this->inA(function () use ($visit) {
            $v = ClinicalNote::where('visit_id', $visit)->firstOrFail()->versions->firstWhere('state', 'draft');

            return ['revision' => $v->revision, 'source' => $v->source] + $v->soap();
        });
    }

    private function counts(): array
    {
        return $this->inA(fn () => ['signed' => ClinicalNoteVersion::where('state', 'signed')->count(), 'versions' => ClinicalNoteVersion::count(),
            'final_findings' => ToothFinding::where('state', 'final')->count(), 'outbox' => Outbox::count()]);
    }

    private function sugg(array $x): array
    {
        return $this->as(self::DOKTER)->getJson("/api/visits/{$x['visit']}/icd-suggestions")->assertOk()->json();
    }

    private static function codes(array $r): array
    {
        return array_map(fn ($i) => $i['system'].':'.$i['code'], $r['items']);
    }

    public function test_free_mode_stores_cited_deterministic_drafts_once_and_never_calls_a_model(): void
    {
        $x = $this->fixture();
        $r = $this->sugg($x);
        $this->assertSame(['icd10:K02.9', 'icd10:K02.1', 'icd10:K08.3', 'icd9cm:23.2', 'icd9cm:23.09'], self::codes($r));
        $this->assertSame(['draf' => 5, 'disetujui' => 0, 'ditolak' => 0], $r['counts']);
        $this->assertFalse($r['paid']);
        $k029 = $r['items'][0];
        $this->assertSame(['Dental caries, unspecified', 'ICD10_2010', 'deterministik', 'synonym', true], [$k029['display'], $k029['version'], $k029['source'], $k029['why'], $k029['perlu_dicek']]);
        $this->assertSame(['F1', 'F3', 'A'], array_column($k029['citations'], 'ref'));
        $this->assertSame([$x['f']['36'], 36, 'O'], [$k029['citations'][0]['id'], $k029['citations'][0]['tooth'], $k029['citations'][0]['surface']]);
        $this->assertSame('exact_code', $r['items'][3]['why']);
        $this->assertSame(0, $this->fake->calls);

        $this->inA(function () use ($x) {
            $run = AgentRun::sole();
            $this->assertSame(['koding', 'deterministik', 'id-lokal', 'icd-kamus-v1', 'berhasil', $x['patient']],
                [$run->agent, $run->generator, $run->region, $run->prompt_version, $run->outcome, $run->patient_id]);
            $this->assertSame(1, AuditEvent::where('action', 'ai_panggil')->where('entity_id', $run->id)->count());
            $this->assertSame(5, AgentDraft::where('kind', 'saran_icd')->where('target_id', $x['visit'])->count());
        });
        $this->sugg($x);
        $this->inA(fn () => $this->assertSame([1, 5], [AgentRun::count(), AgentDraft::count()]));
    }

    public function test_approve_adds_the_code_to_the_open_draft_only_never_signs(): void
    {
        $x = $this->fixture();
        $items = $this->sugg($x)['items'];
        $before = $this->counts();
        $draft0 = $this->draft($x['visit']);

        $r = $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[1]['id']}/approve")->assertOk()
            ->assertJsonPath('state', 'disetujui')->assertJsonPath('note.codes', ['K02.1'])->assertJsonPath('note.added', true);
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[4]['id']}/approve")->assertOk()->assertJsonPath('note.codes', ['23.09']);

        $d = $this->draft($x['visit']);
        $this->assertSame([['K02.1'], ['23.09']], [$d['A']['codes'], $d['P']['codes']]);
        $this->assertSame([$draft0['S'], $draft0['O'], $draft0['A']['text'], $draft0['P']['text'], 'manual'], [$d['S'], $d['O'], $d['A']['text'], $d['P']['text'], $d['source']]);
        $this->assertSame($draft0['revision'] + 2, $d['revision']);
        $this->assertSame($before, $this->counts());
        $this->inA(fn () => $this->assertSame('berlangsung', Visit::findOrFail($x['visit'])->status));

        // codes on the draft do not trigger a new run; the approved one stays listed
        $after = $this->sugg($x);
        $this->assertSame(['draf' => 3, 'disetujui' => 2, 'ditolak' => 0], $after['counts']);
        $this->inA(fn () => $this->assertSame(1, AgentRun::count()));
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[1]['id']}/approve")->assertStatus(409)->assertJsonPath('error', 'wrong_state');
    }

    public function test_approve_creates_the_draft_note_when_missing_and_is_idempotent_on_existing_code(): void
    {
        $x = $this->fixture(false);
        $items = $this->sugg($x)['items'];
        $this->assertSame(['icd10:K08.3', 'icd10:K02.9', 'icd9cm:23.2'], self::codes(['items' => $items]));
        $before = $this->counts();
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[2]['id']}/approve")->assertOk();
        $d = $this->draft($x['visit']);
        $this->assertSame([['23.2'], '', '', 1, 'ai_draft'], [$d['P']['codes'], $d['S'], $d['A']['text'], $d['revision'], $d['source']]);
        $this->assertSame(['signed' => $before['signed'], 'versions' => $before['versions'] + 1] + $before, $this->counts());

        $again = $this->inA(fn () => app(VisitCoding::class)->addDraftCode($x['visit'], IcdSystem::Icd9cm, '23.2'));
        $this->assertSame([false, 1, ['23.2']], [$again['added'], $again['revision'], $again['codes']]);
        foreach ([[IcdSystem::Icd9cm, 'K02.1', 'bad_code'], [IcdSystem::Icd10, '23.2', 'bad_code']] as [$sys, $code, $why]) {
            try {
                $this->inA(fn () => app(VisitCoding::class)->addDraftCode($x['visit'], $sys, $code));
                $this->fail('accepted');
            } catch (CodingRefused $e) {
                $this->assertSame($why, $e->reason);
            }
        }
    }

    public function test_reject_stores_reason_as_feedback(): void
    {
        $x = $this->fixture();
        $items = $this->sugg($x)['items'];
        $before = $this->counts();
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[0]['id']}/reject", ['reason' => 'terlalu_umum'])->assertOk()->assertJsonPath('state', 'ditolak');
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[1]['id']}/reject")->assertOk();
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[2]['id']}/reject", ['reason' => 'karangan'])->assertStatus(422);

        $this->inA(function () use ($items) {
            $this->assertSame('terlalu_umum', Crypto::decrypt(AgentDraft::findOrFail($items[0]['id'])->reject_reason_enc));
            $this->assertSame('tidak_sesuai', Crypto::decrypt(AgentDraft::findOrFail($items[1]['id'])->reject_reason_enc));
        });
        $this->assertSame(['draf' => 3, 'disetujui' => 0, 'ditolak' => 2], $this->sugg($x)['counts']);
        $this->assertSame([], $this->draft($x['visit'])['A']['codes']);
        $this->assertSame($before, $this->counts());
    }

    public function test_edited_text_supersedes_open_drafts_and_never_resuggests_reviewed_codes(): void
    {
        $x = $this->fixture();
        $items = $this->sugg($x)['items'];
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[2]['id']}/reject")->assertOk(); // K08.3
        $rev = $this->draft($x['visit'])['revision'];
        $this->as(self::DOKTER)->putJson("/api/visits/{$x['visit']}/note", ['revision' => $rev, 'soap' => ['A' => ['text' => 'Pulpitis ireversibel 36, sisa akar 46'], 'P' => ['text' => 'PSA 36']]])->assertOk();

        $r = $this->sugg($x);
        $open = array_values(array_filter($r['items'], fn ($i) => $i['state'] === 'draf'));
        $this->assertContains('icd10:K04.0', self::codes(['items' => $open]));
        $this->assertContains('icd9cm:23.70', self::codes(['items' => $open]));
        $this->assertNotContains('icd10:K08.3', self::codes(['items' => $open]));
        $this->inA(fn () => $this->assertSame(['digantikan', 2], [AgentDraft::findOrFail($items[0]['id'])->state->value, AgentRun::count()]));
    }

    public function test_approve_all_is_idempotent(): void
    {
        $x = $this->fixture();
        $this->sugg($x);
        $first = $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/icd-suggestions/approve-all")->assertOk();
        $this->assertCount(5, $first->json('approved'));
        $d = $this->draft($x['visit']);
        $this->assertSame([['K02.9', 'K02.1', 'K08.3'], ['23.2', '23.09']], [$d['A']['codes'], $d['P']['codes']]);
        $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/icd-suggestions/approve-all")->assertOk()->assertJsonPath('approved', []);
        $this->assertSame($d, $this->draft($x['visit']));
        $this->inA(fn () => $this->assertSame(1, AgentRun::count()));
    }

    public function test_signed_visit_is_read_only(): void
    {
        $x = $this->fixture();
        $items = $this->sugg($x)['items'];
        $this->inA(function () use ($x) {
            $n = ClinicalNote::where('visit_id', $x['visit'])->firstOrFail();
            DB::table('clinical_note_version')->insert(['tenant_id' => $this->tenantA()->id, 'id' => (string) Str::uuid7(), 'note_id' => $n->id,
                'version' => 2, 'revision' => 1, 'state' => 'signed', 'source' => 'manual', 'soap_enc' => Crypto::encrypt('{}'), 'content_hash' => str_repeat('0', 64),
                'created_by' => $this->user(self::DOKTER)->id, 'signed_by' => $this->user(self::DOKTER)->id, 'signed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        });
        $this->assertTrue($this->sugg($x)['locked']);
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[0]['id']}/approve")->assertStatus(409)->assertJsonPath('error', 'visit_closed');
        $this->as(self::DOKTER)->postJson("/api/visits/{$x['visit']}/icd-suggestions/approve-all")->assertStatus(409);
        $this->inA(fn () => $this->assertSame('menunggu_review', AgentDraft::findOrFail($items[0]['id'])->state->value));
    }

    public function test_patient_without_open_visit_gets_a_preview_that_stores_nothing(): void
    {
        $x = $this->fixture(false);
        $this->inA(fn () => Visit::whereKey($x['visit'])->update(['status' => 'selesai']));
        $r = $this->as(self::DOKTER)->getJson("/api/patients/{$x['patient']}/icd-suggestions")->assertOk()
            ->assertJsonPath('visit_id', null)->assertJsonPath('locked', true)->assertJsonCount(3, 'items');
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
        $id = $this->sugg($x)['items'][0]['id'];
        $this->as($email)->getJson("/api/visits/{$x['visit']}/icd-suggestions")->assertForbidden();
        $this->as($email)->getJson("/api/patients/{$x['patient']}/icd-suggestions")->assertForbidden();
        $this->as($email)->postJson("/api/icd-suggestions/$id/approve")->assertForbidden();
        $this->as($email)->postJson("/api/icd-suggestions/$id/reject")->assertForbidden();
        $this->as($email)->postJson("/api/visits/{$x['visit']}/icd-suggestions/approve-all")->assertForbidden();
        $this->assertSame([], $this->draft($x['visit'])['A']['codes']);
    }

    public function test_generic_draft_endpoint_cannot_bypass_the_coding_step(): void
    {
        $x = $this->fixture();
        $id = $this->sugg($x)['items'][0]['id'];
        $this->as(self::DOKTER)->postJson("/api/ai-drafts/$id/approve")->assertStatus(409)->assertJsonPath('error', 'own_flow');
        $this->as(self::DOKTER)->postJson("/api/ai-drafts/$id/reject", ['reason' => 'uji generik'])->assertStatus(409)->assertJsonPath('error', 'own_flow');
        $this->inA(fn () => $this->assertSame('menunggu_review', AgentDraft::findOrFail($id)->state->value));
        $this->assertSame([], $this->draft($x['visit'])['A']['codes']);
    }

    public function test_other_tenant_sees_nothing(): void
    {
        $x = $this->fixture();
        $id = $this->sugg($x)['items'][0]['id'];
        $b = 'dokter@ceria.test';
        $this->as($b)->getJson("/api/visits/{$x['visit']}/icd-suggestions")->assertNotFound();
        $this->as($b)->postJson("/api/icd-suggestions/$id/approve")->assertNotFound();
        $this->as($b)->postJson("/api/icd-suggestions/$id/reject")->assertNotFound();
        $this->as($b)->postJson("/api/visits/{$x['visit']}/icd-suggestions/approve-all")->assertNotFound();
        $this->as($b)->getJson("/api/patients/{$x['patient']}/icd-suggestions")->assertOk()->assertJsonPath('items', []);
        $this->inA(fn () => $this->assertSame('menunggu_review', AgentDraft::findOrFail($id)->state->value));
    }

    public function test_paid_switch_re_picks_a_cited_subset_without_identifiers_in_the_prompt(): void
    {
        $x = $this->fixture();
        $this->inA(fn () => ClinicAiSetting::create(['paid_enabled' => true]));
        $this->fake->willReply(json_encode(['suggestions' => [
            ['system' => 'icd10', 'code' => 'K02.1', 'text' => 'dentin', 'refs' => ['A', 'F1']],
            ['system' => 'icd9cm', 'code' => '23.09', 'text' => 'cabut', 'refs' => ['P']],
        ]]));
        $r = $this->sugg($x);
        $this->assertTrue($r['paid']);
        $this->assertSame(['icd10:K02.1', 'icd9cm:23.09'], self::codes($r));
        $this->assertSame(['model', ['A', 'F1']], [$r['items'][0]['source'], array_column($r['items'][0]['citations'], 'ref')]);
        $this->assertSame(1, $this->fake->calls);

        $input = $this->sent[0]->input;
        foreach ([$x['name'], self::NIK, $x['patient'], $x['visit'], $x['f']['36']] as $secret) {
            $this->assertStringNotContainsString($secret, $input);
        }
        $this->assertStringContainsString('[NAMA]', $input);
        $this->assertStringContainsString('"code":"K02.1"', $input);
        $this->inA(function () {
            $run = AgentRun::sole();
            $this->assertSame(['llm', 'koding', 'icd-koding-v1', 'berhasil', 2, 0], [$run->generator, $run->agent, $run->prompt_version, $run->outcome, $run->claims_total, $run->claims_dropped]);
            $this->assertGreaterThanOrEqual(2, $run->redactions); // name + NIK
        });
    }

    public static function badReplies(): array
    {
        return [
            'model down' => [null],
            'not json' => ['maaf, saya tidak bisa'],
            'unknown ref' => [json_encode(['suggestions' => [['system' => 'icd10', 'code' => 'K02.1', 'refs' => ['N9']]]])],
            'invented code' => [json_encode(['suggestions' => [['system' => 'icd10', 'code' => 'K02.5', 'refs' => ['A']]]])],
            'code outside candidates' => [json_encode(['suggestions' => [['system' => 'icd10', 'code' => 'K05.3', 'refs' => ['A']]]])],
            'too many dropped' => [json_encode(['suggestions' => [['system' => 'icd10', 'code' => 'K02.1', 'refs' => ['A']],
                ['system' => 'icd10', 'code' => 'K99.9', 'refs' => ['A']], ['system' => 'icd9cm', 'code' => '23.09', 'refs' => []]]])],
        ];
    }

    #[DataProvider('badReplies')]
    public function test_paid_failures_fall_back_to_deterministic_drafts(?string $reply): void
    {
        $x = $this->fixture();
        config(['ai.paid_ai.default' => true]);
        $reply === null ? $this->fake->willFail('timeout') : $this->fake->willReply($reply);

        $r = $this->sugg($x);
        $this->assertSame(['icd10:K02.9', 'icd10:K02.1', 'icd10:K08.3', 'icd9cm:23.2', 'icd9cm:23.09'], self::codes($r));
        $this->assertSame(['deterministik'], array_values(array_unique(array_column($r['items'], 'source'))));
        $this->inA(function () use ($reply) {
            $runs = AgentRun::orderBy('started_at')->orderBy('generator')->get();
            $this->assertSame([['berhasil', 'deterministik'], [$reply === null ? 'gagal' : 'berhenti_minta_manusia', 'llm']],
                $runs->map(fn ($r) => [$r->outcome, $r->generator])->sortBy(fn ($r) => $r[1])->values()->all());
            $this->assertSame(2, AuditEvent::where('action', 'ai_panggil')->count());
        });
    }

    public function test_model_not_on_allowlist_is_never_called(): void
    {
        $x = $this->fixture();
        config(['ai.paid_ai.default' => true, 'ai.icd.model_id' => 'us.qwen.qwen3-32b-v1:0']);
        $this->assertCount(5, $this->sugg($x)['items']);
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_clinic_row_wins_over_config_default(): void
    {
        $x = $this->fixture();
        config(['ai.paid_ai.default' => true]);
        $this->inA(fn () => ClinicAiSetting::create(['paid_enabled' => false]));
        $this->sugg($x);
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_no_clinical_text_or_identifiers_in_audit_or_run_rows(): void
    {
        $x = $this->fixture();
        config(['ai.paid_ai.default' => true]);
        $this->fake->willReply(json_encode(['suggestions' => [['system' => 'icd10', 'code' => 'K02.1', 'refs' => ['A']]]]));
        $items = $this->sugg($x)['items'];
        $this->as(self::DOKTER)->postJson("/api/icd-suggestions/{$items[0]['id']}/approve")->assertOk();

        $rows = $this->inA(fn () => json_encode([AgentRun::all()->toArray(), AuditEvent::all()->toArray()]));
        foreach ([$x['name'], self::NIK, 'berlubang', 'Ngilu', 'cabut', 'Caries of dentine'] as $secret) {
            $this->assertStringNotContainsStringIgnoringCase($secret, $rows);
        }
    }
}
