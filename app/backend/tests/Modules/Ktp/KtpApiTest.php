<?php

namespace Tests\Modules\Ktp;

use App\Modules\Agents\Models\AgentDraft;
use App\Modules\Agents\Models\AgentRun;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Modules\Ktp\Contracts\KtpExtractor;
use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\KtpPhotoStore;
use App\Modules\Ktp\Contracts\PaidAiDisabled;
use App\Modules\Ktp\Models\ClinicAiSetting;
use App\Modules\Ktp\Models\KtpPhoto;
use App\Modules\Ktp\Models\PatientKtp;
use App\Modules\Ktp\Services\BedrockNovaLiteKtpExtractor;
use App\Modules\Ktp\Services\ManualKtpExtractor;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

// Synthetic NIK 3201011501900001 = 32/01/01, 15 Jan 1990, laki-laki.
class KtpApiTest extends TestCase
{
    public const NIK = '3201011501900001';

    private FakeModelClient $fake;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fake = new FakeModelClient;
        $this->app->instance(ModelClient::class, $this->fake);
    }

    private function newPatient(): string
    {
        return $this->as('depan@senyum.test')->postJson('/api/patients', ['name' => 'Budi KTP Sintetis', 'nik' => self::NIK,
            'dob' => '1990-01-15', 'sex' => 'laki_laki'])->assertCreated()->json('id');
    }

    private function photo(string $email = 'depan@senyum.test'): string
    {
        return $this->as($email)->post('/api/ktp/photos', ['photo' => UploadedFile::fake()->image('ktp.jpg', 40, 25)])->assertCreated()->json('id');
    }

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn, $this->user('depan@senyum.test')->id);
    }

    public function test_check_reports_field_mismatches_and_never_echoes_the_nik(): void
    {
        $r = $this->as('depan@senyum.test')->postJson('/api/ktp/check', ['nik' => '3201 0115 0190 0001', 'dob' => '1990-01-16',
            'sex' => 'perempuan', 'province_code' => '32', 'regency_code' => '2', 'district_code' => '01'])->assertOk()
            ->assertJson(['valid_length' => true, 'mismatches' => ['dob', 'sex', 'regency'],
                'parsed' => ['province_code' => '32', 'regency_code' => '01', 'district_code' => '01', 'dob' => '1990-01-15', 'sex' => 'laki_laki']]);
        $this->assertStringNotContainsString(self::NIK, $r->getContent());
        $this->as('depan@senyum.test')->postJson('/api/ktp/check', ['nik' => '32010115'])->assertOk()
            ->assertJson(['valid_length' => false, 'mismatches' => ['nik'], 'parsed' => null]);
        $this->as('kasir@senyum.test')->postJson('/api/ktp/check', ['nik' => self::NIK])->assertOk(); // patient.read
    }

    public function test_photo_is_encrypted_and_tenant_scoped(): void
    {
        $id = $this->photo();
        $this->inA(function () use ($id) {
            $row = KtpPhoto::findOrFail($id);
            $raw = app(KtpPhotoStore::class)->bytes($id);
            $this->assertStringStartsWith("\xFF\xD8", $raw); // JPEG
            $this->assertStringNotContainsString(base64_encode(substr($raw, 0, 30)), $row->bytes_enc);
            $this->assertSame('image/jpeg', $row->mime);
        });
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertNull(app(KtpPhotoStore::class)->get($id)));
        $this->as('kasir@senyum.test')->post('/api/ktp/photos', ['photo' => UploadedFile::fake()->image('k.jpg')])->assertForbidden();
        $this->as('depan@senyum.test')->post('/api/ktp/photos', ['photo' => UploadedFile::fake()->create('k.pdf', 10, 'application/pdf')])->assertUnprocessable();
    }

    public function test_put_ktp_saves_verification_and_returns_masked_nik(): void
    {
        $pid = $this->newPatient();
        $photo = $this->photo();
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['province_code' => '32', 'regency_code' => '02',
            'district_code' => '01', 'photo_id' => $photo])->assertOk()
            ->assertJson(['valid_length' => true, 'mismatches' => ['regency'], 'nik' => '3201********0001']);
        $this->inA(function () use ($pid, $photo) {
            $row = PatientKtp::where('patient_id', $pid)->firstOrFail();
            $this->assertSame(['32', '02', '01', $photo, 'manual', $this->user('depan@senyum.test')->id],
                [$row->province_code, $row->regency_code, $row->district_code, $row->photo_id, $row->source, $row->verified_by]);
            $this->assertSame($pid, KtpPhoto::findOrFail($photo)->patient_id);
        });
        // Second save updates the same row (one row per patient).
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['regency_code' => '01'])->assertOk()->assertJsonPath('mismatches', []);
        $this->assertSame(1, $this->inA(fn () => PatientKtp::where('patient_id', $pid)->count()));
        $this->as('kasir@senyum.test')->putJson("/api/patients/$pid/ktp", [])->assertForbidden();
    }

    public function test_get_ktp_unmasked_only_with_permission_and_audited(): void
    {
        $pid = $this->newPatient();
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['province_code' => '32', 'photo_id' => $this->photo()])->assertOk();
        $this->as('dokter@senyum.test')->getJson("/api/patients/$pid/ktp")->assertOk()
            ->assertJson(['nik' => self::NIK, 'province_code' => '32', 'source' => 'manual', 'photo' => ['mime' => 'image/jpeg']]);
        $this->as('pemilik@senyum.test')->getJson("/api/patients/$pid/ktp")->assertOk()->assertJsonPath('nik', self::NIK);
        foreach (['depan@senyum.test', 'kasir@senyum.test', 'asisten@senyum.test'] as $email) {
            $this->as($email)->getJson("/api/patients/$pid/ktp")->assertForbidden();
        }
        $this->as('dokter@senyum.test')->getJson("/api/patients/$pid")->assertOk()->assertJsonPath('nik', '3201********0001');
        $audit = $this->inA(fn () => AuditEvent::where('action', 'ktp_lihat')->where('entity_id', $pid)->get());
        $this->assertCount(2, $audit);
        $this->assertSame([], $audit[0]->detail ?? []);
    }

    public function test_other_tenant_gets_404(): void
    {
        $pid = $this->newPatient();
        $photo = $this->photo();
        $this->as('dokter@ceria.test')->getJson("/api/patients/$pid/ktp")->assertNotFound();
        $this->as('dokter@ceria.test')->putJson("/api/patients/$pid/ktp", ['province_code' => '32'])->assertNotFound();
        $own = $this->patientOf($this->tenantB())->id;
        $this->as('dokter@ceria.test')->putJson("/api/patients/$own/ktp", ['photo_id' => $photo])->assertNotFound();
    }

    public function test_photo_of_another_patient_is_refused(): void
    {
        $pid = $this->newPatient();
        $photo = $this->photo();
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['photo_id' => $photo])->assertOk();
        $other = $this->patientOf($this->tenantA())->id;
        $this->as('depan@senyum.test')->putJson("/api/patients/$other/ktp", ['photo_id' => $photo])->assertNotFound();
    }

    public function test_paid_switch_off_by_default_resolves_manual_and_nova_refuses_without_touching_the_model(): void
    {
        $this->assertFalse(config('ai.paid_ai.default'));
        $this->assertSame('manual', config('ai.ktp.extractor'));
        $this->assertContains('amazon.nova-lite-v1:0', config('ai.allowed_model_ids'));
        config(['ai.ktp.extractor' => 'nova_lite']);
        $photo = $this->photo();
        $this->inA(function () use ($photo) {
            $this->assertInstanceOf(ManualKtpExtractor::class, app(KtpExtractor::class)); // switch off wins over nova_lite
            $runs = AgentRun::count();
            try {
                app(BedrockNovaLiteKtpExtractor::class)->extract(new KtpInput(nik: self::NIK), app(KtpPhotoStore::class)->get($photo));
                $this->fail('expected PaidAiDisabled');
            } catch (PaidAiDisabled) {
            }
            $this->assertSame(0, $this->fake->calls);
            $this->assertSame($runs, AgentRun::count());
            $manual = app(KtpExtractor::class)->extract(new KtpInput(nik: self::NIK, sex: 'perempuan'));
            $this->assertSame(['manual', ['sex'], null], [$manual->source, $manual->check->mismatches, $manual->runId]);
        });
    }

    public function test_clinic_row_overrides_config_both_ways(): void
    {
        $this->inA(function () {
            ClinicAiSetting::create(['paid_enabled' => true]);
            config(['ai.ktp.extractor' => 'nova_lite']);
            $this->assertInstanceOf(BedrockNovaLiteKtpExtractor::class, app(KtpExtractor::class));
            ClinicAiSetting::query()->update(['paid_enabled' => false]);
            config(['ai.paid_ai.default' => true]);
            $this->assertInstanceOf(ManualKtpExtractor::class, app(KtpExtractor::class));
        });
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertFalse(ClinicAiSetting::query()->exists()));
    }

    public function test_nova_when_on_goes_through_agent_runs_and_leaves_a_draft(): void
    {
        $pid = $this->newPatient();
        $photo = $this->photo();
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['photo_id' => $photo])->assertOk();
        $this->fake->willReply(json_encode(['nik' => self::NIK, 'name' => 'Budi KTP Sintetis', 'dob' => '1990-01-15', 'sex' => 'perempuan',
            'province_code' => '32', 'regency_code' => '01', 'district_code' => '01']))->willReply('bukan json');
        $this->inA(function () use ($photo, $pid) {
            ClinicAiSetting::create(['paid_enabled' => true]);
            $nova = app(BedrockNovaLiteKtpExtractor::class);
            $x = $nova->extract(new KtpInput, app(KtpPhotoStore::class)->get($photo));
            $this->assertSame(['nova_lite', ['sex']], [$x->source, $x->check->mismatches]);
            $run = AgentRun::findOrFail($x->runId);
            $this->assertSame(['pendaftaran', 'ktp-nova-lite-v1', 'berhasil', $pid], [$run->agent, $run->prompt_version, $run->outcome, $run->patient_id]);
            $this->assertStringNotContainsString(self::NIK, json_encode($run->getAttributes()));
            $draft = AgentDraft::findOrFail($x->draftId);
            $this->assertSame(['pendaftaran', 'menunggu_review', 'patient', $pid], [$draft->kind->value, $draft->state->value, $draft->target_type, $draft->target_id]);
            $this->assertStringNotContainsString(self::NIK, $draft->payload_enc);
            $this->assertSame(self::NIK, $draft->payload()['nik']);

            $bad = $nova->extract(new KtpInput(sex: 'laki_laki'), app(KtpPhotoStore::class)->get($photo)); // reply not JSON
            $this->assertSame([null, 'berhenti_minta_manusia'], [$bad->draftId, AgentRun::findOrFail($bad->runId)->outcome]);
            $this->assertNull($bad->proposed->nik);
        });
        $this->assertSame(2, $this->fake->calls);
    }

    public function test_photo_stream_is_audited_tenant_scoped_and_permissioned(): void
    {
        $pid = $this->newPatient();
        $this->as('dokter@senyum.test')->get("/api/patients/$pid/ktp/photo")->assertNotFound();
        $file = UploadedFile::fake()->image('ktp.jpg', 40, 25);
        $raw = file_get_contents($file->getRealPath());
        $photo = $this->as('depan@senyum.test')->post('/api/ktp/photos', ['photo' => $file])->assertCreated()->json('id');
        $this->as('depan@senyum.test')->putJson("/api/patients/$pid/ktp", ['photo_id' => $photo])->assertOk();

        $res = $this->as('dokter@senyum.test')->get("/api/patients/$pid/ktp/photo");
        $res->assertOk()->assertHeader('content-type', 'image/jpeg');
        $this->assertSame($raw, $res->getContent());
        $this->as('depan@senyum.test')->get("/api/patients/$pid/ktp/photo")->assertForbidden();
        $this->as('kasir@senyum.test')->get("/api/patients/$pid/ktp/photo")->assertForbidden();
        $this->as('dokter@ceria.test')->get("/api/patients/$pid/ktp/photo")->assertNotFound();

        $this->as('dokter@senyum.test')->getJson("/api/patients/$pid/ktp/attachment")
            ->assertOk()->assertJsonPath('photo.id', $photo)->assertJsonMissing(['nik']);
        $this->as('depan@senyum.test')->getJson("/api/patients/$pid/ktp/attachment")->assertForbidden();
        $this->as('dokter@ceria.test')->getJson("/api/patients/$pid/ktp/attachment")->assertNotFound();

        $audit = $this->inA(fn () => AuditEvent::where('action', 'ktp_foto_lihat')->where('entity_id', $pid)->get());
        $this->assertCount(1, $audit);
        $this->assertSame('patient', $audit[0]->entity_type);
        $this->assertStringNotContainsString(self::NIK, json_encode($audit[0]->detail) ?: '');
        $this->assertStringNotContainsString($raw, json_encode($audit[0]->detail) ?: '');
    }
}
