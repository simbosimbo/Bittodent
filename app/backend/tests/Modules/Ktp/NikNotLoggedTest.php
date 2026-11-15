<?php

namespace Tests\Modules\Ktp;

use App\Modules\Agents\Models\AgentRun;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\KtpPhotoStore;
use App\Modules\Ktp\Models\ClinicAiSetting;
use App\Modules\Ktp\Services\BedrockNovaLiteKtpExtractor;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\UploadedFile;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

// The raw NIK must never reach audit_event.detail, agent_run, or the application log.
class NikNotLoggedTest extends TestCase
{
    public function test_nik_never_in_audit_agent_run_or_log(): void
    {
        $nik = KtpApiTest::NIK;
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $m) use (&$logged) {
            $logged[] = $m->message.json_encode($m->context);
        });
        $logFile = storage_path('logs/laravel.log');
        $logBefore = is_file($logFile) ? filesize($logFile) : 0;
        $fake = new FakeModelClient;
        $this->app->instance(ModelClient::class, $fake);

        $front = $this->as('depan@senyum.test');
        $pid = $front->postJson('/api/patients', ['name' => 'Sari NIK Sintetis', 'nik' => $nik])->assertCreated()->json('id');
        $front->postJson('/api/ktp/check', ['nik' => $nik, 'sex' => 'perempuan'])->assertOk();
        $photo = $front->post('/api/ktp/photos', ['photo' => UploadedFile::fake()->image('ktp.jpg')])->assertCreated()->json('id');
        $front->putJson("/api/patients/$pid/ktp", ['province_code' => '31', 'photo_id' => $photo])->assertOk();
        $front->getJson("/api/patients/$pid")->assertOk();
        $this->as('dokter@senyum.test')->getJson("/api/patients/$pid")->assertOk();
        $this->as('dokter@senyum.test')->getJson("/api/patients/$pid/ktp")->assertOk()->assertJsonPath('nik', $nik); // ktp_lihat
        $this->as('depan@senyum.test')->getJson("/api/patients/$pid/ktp")->assertForbidden(); // akses_ditolak row
        $fake->willReply(json_encode(['nik' => $nik]));
        Ctx::runAs($this->tenantA()->id, function () use ($photo) {
            ClinicAiSetting::create(['paid_enabled' => true]);
            app(BedrockNovaLiteKtpExtractor::class)->extract(new KtpInput, app(KtpPhotoStore::class)->get($photo));
        }, $this->user('depan@senyum.test')->id);
        Log::info('uji log A4', ['patient_id' => $pid]); // the log channel is live during the test

        [$audit, $runs] = Ctx::runAs($this->tenantA()->id, fn () => [
            AuditEvent::whereIn('action', ['buat', 'baca', 'ktp_lihat', 'ktp_simpan', 'ktp_foto_simpan', 'akses_ditolak', 'ai_panggil'])->get(),
            AgentRun::where('agent', 'pendaftaran')->get(),
        ]);
        $this->assertContains('ktp_lihat', $audit->pluck('action')->all());
        $this->assertContains('ai_panggil', $audit->pluck('action')->all());
        $this->assertCount(1, $runs);
        $this->assertStringNotContainsString($nik, $audit->map->getAttributes()->toJson());
        $this->assertStringNotContainsString($nik, $runs->map->getAttributes()->toJson());
        $this->assertNotEmpty($logged);
        $this->assertStringNotContainsString($nik, implode("\n", $logged));
        if (is_file($logFile)) {
            $this->assertStringNotContainsString($nik, (string) file_get_contents($logFile, offset: $logBefore));
        }
    }
}
