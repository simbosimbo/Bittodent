<?php

namespace Tests\Modules\Scribe;

use App\Modules\Agents\Models\AgentRun;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Modules\Scribe\Contracts\AudioStore;
use App\Modules\Scribe\Contracts\ScribeSessionState;
use App\Modules\Scribe\Contracts\SpeechToText;
use App\Modules\Scribe\Models\ScribeSession;
use App\Modules\Scribe\Services\FakeSpeechToText;
use App\Shared\Ai\ClinicAiSetting;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

// A3 scribe: paid gate (both switches), tenant wall, audio wipe, draft-only (never writes clinical_note_version),
// citation validation, monthly token cap. Synthetic data only.
class ScribeApiTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const DOC_B = 'dokter@ceria.test';

    private const OTHER_DOC = 'dokter.bunga@senyum.test';

    private FakeModelClient $fake;

    private FakeSpeechToText $stt;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fake = new FakeModelClient;
        $this->stt = new FakeSpeechToText;
        $this->app->instance(ModelClient::class, $this->fake);
        $this->app->instance(SpeechToText::class, $this->stt);
    }

    private function walkIn(string $as = self::DOC): string
    {
        $p = $this->patientOf($as === self::DOC_B ? $this->tenantB() : $this->tenantA())->id;

        return $this->as($as)->postJson("/api/patients/$p/visits/walk-in")->assertSuccessful()->json('id');
    }

    private function enablePaid(bool $global = true, bool $clinic = true, ?int $cap = null): void
    {
        config(['ai.paid_ai.default' => $global]);
        Ctx::runAs($this->tenantA()->id, function () use ($clinic, $cap) {
            $row = ClinicAiSetting::query()->first();
            $row ? $row->update(['paid_enabled' => $clinic, 'monthly_token_cap' => $cap])
                : ClinicAiSetting::create(['paid_enabled' => $clinic, 'monthly_token_cap' => $cap]);
        });
    }

    private function scriptSoap(): void
    {
        $this->fake->willReply(json_encode(['claims' => [
            ['section' => 'S', 'text' => 'Nyeri berdenyut gigi 46 sejak tiga hari.', 'refs' => ['T1']],
            ['section' => 'O', 'text' => 'Perkusi positif, tanpa pembengkakan.', 'refs' => ['T2']],
            ['section' => 'A', 'text' => 'Iritasi pulpa akut 46.', 'refs' => ['T3']],
            ['section' => 'P', 'text' => 'Perawatan saluran akar 46, kontrol satu minggu.', 'refs' => ['T4']],
        ]], JSON_UNESCAPED_UNICODE));
    }

    private function upload(string $visit, string $as = self::DOC)
    {
        $file = UploadedFile::fake()->create('dikte.webm', 20, 'audio/webm');

        return $this->as($as)->post("/api/visits/$visit/scribe", ['duration_sec' => 8, 'audio' => $file]);
    }

    public function test_paid_off_get_is_disabled_and_post_is_403(): void
    {
        $visit = $this->walkIn();
        $this->as(self::DOC)->getJson("/api/visits/$visit/scribe")
            ->assertOk()->assertJsonPath('disabled', true)->assertJsonPath('paid_enabled', false)->assertJsonPath('session', null);
        $this->upload($visit)->assertForbidden()->assertJsonPath('error', 'paid_disabled');
        $this->assertSame(0, $this->fake->calls);
        $this->assertSame(0, $this->stt->calls);
        $this->assertSame(0, Ctx::runAs($this->tenantA()->id, fn () => ScribeSession::count()));
    }

    public function test_only_one_switch_on_is_still_403(): void
    {
        $visit = $this->walkIn();
        $this->enablePaid(true, false);
        $this->upload($visit)->assertForbidden()->assertJsonPath('error', 'paid_disabled');
        $this->enablePaid(false, true);
        $this->upload($visit)->assertForbidden()->assertJsonPath('error', 'paid_disabled');
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_happy_path_wipes_audio_and_approve_does_not_write_a_note(): void
    {
        $this->enablePaid();
        $this->scriptSoap();
        $visit = $this->walkIn();
        $notesBefore = Ctx::runAs($this->tenantA()->id, fn () => ClinicalNoteVersion::count());
        $r = $this->upload($visit)->assertCreated();
        $this->assertFalse($r->json('disabled'));
        $this->assertNotEmpty($r->json('items'));
        $this->assertTrue($r->json('session.audio_deleted'));
        $this->assertSame('draf_siap', $r->json('session.state'));
        $sessionId = $r->json('session.id');
        Ctx::runAs($this->tenantA()->id, function () use ($sessionId) {
            $this->assertFalse(app(AudioStore::class)->exists($sessionId));
            $this->assertNotNull(ScribeSession::findOrFail($sessionId)->audio_deleted_at);
            $this->assertSame(1, AuditEvent::where('action', 'hapus')->where('entity_type', 'scribe_session')->where('entity_id', $sessionId)->count());
        });
        $draftId = $r->json('items.0.id');
        $this->as(self::DOC)->postJson("/api/scribe/drafts/$draftId/approve")
            ->assertOk()->assertJsonPath('state', 'disetujui');
        $this->assertSame($notesBefore, Ctx::runAs($this->tenantA()->id, fn () => ClinicalNoteVersion::count()));
    }

    public function test_cross_tenant_visit_is_404(): void
    {
        $this->enablePaid();
        $foreign = $this->walkIn(self::DOC_B);
        $this->as(self::DOC)->getJson("/api/visits/$foreign/scribe")->assertNotFound();
        $this->upload($foreign)->assertNotFound();
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_assistant_kasir_and_other_dentist_cannot_upload(): void
    {
        $this->enablePaid();
        $visit = $this->walkIn();
        $file = fn () => ['duration_sec' => 8, 'audio' => UploadedFile::fake()->create('dikte.webm', 20, 'audio/webm')];
        $this->as('asisten@senyum.test')->post("/api/visits/$visit/scribe", $file())->assertForbidden();
        $this->as('kasir@senyum.test')->post("/api/visits/$visit/scribe", $file())->assertForbidden();
        $this->as(self::OTHER_DOC)->post("/api/visits/$visit/scribe", $file())->assertForbidden();
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_claims_without_valid_citations_yield_no_soap_draft(): void
    {
        $this->enablePaid();
        $this->fake->willReply(json_encode(['claims' => [
            ['section' => 'S', 'text' => 'Tanpa sitasi.', 'refs' => []],
            ['section' => 'O', 'text' => 'Sitasi tidak dikenal.', 'refs' => ['TX']],
        ]]));
        $visit = $this->walkIn();
        $this->upload($visit)->assertStatus(422)->assertJsonPath('error', 'processing_failed');
        $status = $this->as(self::DOC)->getJson("/api/visits/$visit/scribe")->assertOk();
        $this->assertSame([], $status->json('items'));
        $this->assertSame('gagal', $status->json('session.state'));
        $sessionId = $status->json('session.id');
        Ctx::runAs($this->tenantA()->id, function () use ($sessionId) {
            $this->assertTrue(app(AudioStore::class)->exists($sessionId));
        });
    }

    public function test_monthly_token_cap_returns_429(): void
    {
        $this->enablePaid(true, true, 10);
        Ctx::runAs($this->tenantA()->id, function () {
            AgentRun::create([
                'agent' => 'scribe', 'provider' => 'fake', 'model_id' => 'fake-deterministik-1', 'region' => 'id-lokal',
                'prompt_version' => 'scribe-soap-v1', 'generator' => 'llm', 'input_refs' => [],
                'input_hash' => str_repeat('a', 64), 'tokens_in' => 8, 'tokens_out' => 8,
                'outcome' => 'berhasil', 'started_at' => now(), 'finished_at' => now(),
            ]);
        }, $this->user(self::DOC)->id);
        $visit = $this->walkIn();
        $this->upload($visit)->assertStatus(429)->assertJsonPath('error', 'token_cap');
        $this->assertSame(0, $this->fake->calls);
    }

    public function test_sweep_wipes_audio_older_than_24h(): void
    {
        $this->enablePaid();
        $visit = $this->walkIn();
        $sessionId = Ctx::runAs($this->tenantA()->id, function () use ($visit) {
            $s = ScribeSession::create([
                'visit_id' => $visit, 'dentist_id' => $this->user(self::DOC)->id,
                'state' => ScribeSessionState::Gagal->value, 'mime' => 'audio/webm', 'duration_sec' => 8,
                'stt_driver' => 'FakeSpeechToText', 'created_at' => now()->subHours(25),
            ]);
            $s->audio_key = app(AudioStore::class)->put($s->id, 'synthetic-bytes', 'audio/webm');
            $s->created_at = now()->subHours(25);
            $s->save();

            return $s->id;
        }, $this->user(self::DOC)->id);
        $this->artisan('scribe:wipe-expired-audio')->assertSuccessful();
        Ctx::runAs($this->tenantA()->id, function () use ($sessionId) {
            $s = ScribeSession::findOrFail($sessionId);
            $this->assertNotNull($s->audio_deleted_at);
            $this->assertFalse(app(AudioStore::class)->exists($sessionId));
            $this->assertSame(1, AuditEvent::where('action', 'hapus')->where('entity_id', $sessionId)->where('detail->reason', 'expired')->count());
        });
    }
}
