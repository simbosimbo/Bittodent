<?php

namespace Tests\Modules\ClinicalSummary;

use App\Modules\Clinical\Contracts\ClinicalHistory;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\MedicalHistoryReader;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Prescriptions\Contracts\PrescriptionHistory;
use App\Modules\Prescriptions\Models\Prescription;
use App\Modules\Prescriptions\Models\PrescriptionVoid;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Tests\TestCase;

// Unit 1: read contracts return signed/final data only, per tenant.
class ReadContractsTest extends TestCase
{
    public function test_clinical_history_has_only_effective_signed_notes_and_current_final_findings(): void
    {
        $p = $this->patientOf($this->tenantA());
        Ctx::runAs($this->tenantA()->id, function () use ($p) {
            $h = app(ClinicalHistory::class)->signedHistory($p->id, 24, 20);
            $this->assertCount(3, $h['visits']);
            $this->assertFalse($h['truncated']);

            // note 1: v1 superseded by signed v2 => only v2; note 2: v1; today's draft note: absent
            $this->assertSame([1, 2], collect($h['notes'])->pluck('version')->sort()->values()->all());
            $this->assertContains('Karies dentin gigi 46 oklusal.', array_column(array_column($h['notes'], 'soap'), 'O'));
            $this->assertNotContains('Karies dentin gigi 36 oklusal.', array_column(array_column($h['notes'], 'soap'), 'O'));
            foreach ($h['notes'] as $n) {
                $this->assertSame('signed', ClinicalNoteVersion::findOrFail($n['id'])->state);
            }
            $this->assertNotContains('Gigi depan atas berlubang.', array_column(array_column($h['notes'], 'soap'), 'S'));

            // final, not superseded; drafts (11 tambalan, 26 karies) excluded
            $this->assertSame(['11|I|karies', '18||perlu_dicabut', '46|O|tambalan'],
                array_map(fn ($f) => "{$f['tooth']}|{$f['surface']}|{$f['condition']}", $h['findings']));
            $this->assertSame(['38' => 'hilang', '48' => 'belum_tumbuh'], $h['baseline']['teeth']);

            $cut = app(ClinicalHistory::class)->signedHistory($p->id, 24, 1);
            $this->assertCount(1, $cut['visits']);
            $this->assertTrue($cut['truncated']);
            $this->assertSame([], $cut['notes']); // newest visit only has a draft
        });
    }

    public function test_medical_history_reader_returns_latest_without_urgent_text(): void
    {
        $p = $this->patientOf($this->tenantA());
        $m = Ctx::runAs($this->tenantA()->id, fn () => app(MedicalHistoryReader::class)->current($p->id));
        $this->assertSame([2, ['Penisilin', 'Lateks'], ['Warfarin (contoh)'], true, true],
            [$m['version'], $m['allergies'], $m['medications'], $m['premedication_required'], $m['has_urgent_note']]);
        $this->assertStringNotContainsString('dokter jantung', json_encode($m));
    }

    public function test_prescription_history_skips_voided_and_unsigned(): void
    {
        Ctx::runAs($this->tenantA()->id, function () {
            $patientId = Prescription::where('state', 'signed')->value('patient_id');
            $list = app(PrescriptionHistory::class)->activeSigned($patientId, 24);
            $this->assertNotEmpty($list);
            $voided = PrescriptionVoid::pluck('prescription_id')->all();
            $this->assertNotEmpty($voided);
            foreach ($list as $rx) {
                $this->assertNotContains($rx['id'], $voided);
                $this->assertSame('signed', Prescription::findOrFail($rx['id'])->state);
                $this->assertNotEmpty($rx['kfa_codes']);
            }
        });
    }

    public function test_contracts_are_tenant_scoped(): void
    {
        $a = $this->patientOf($this->tenantA());
        foreach ([fn () => app(ClinicalHistory::class)->signedHistory($a->id, 24, 20), fn () => app(MedicalHistoryReader::class)->current($a->id),
            fn () => app(PatientDirectory::class)->redactionTerms($a->id)] as $read) {
            try {
                Ctx::runAs($this->tenantB()->id, $read);
                $this->fail('cross-tenant read allowed');
            } catch (ModelNotFoundException) {
                $this->addToAssertionCount(1);
            }
        }
        Ctx::runAs($this->tenantB()->id, fn () => $this->assertSame([], app(PrescriptionHistory::class)->activeSigned($a->id, 24)));
    }

    public function test_redaction_terms_and_license(): void
    {
        $p = $this->patientOf($this->tenantA());
        $terms = Ctx::runAs($this->tenantA()->id, fn () => app(PatientDirectory::class)->redactionTerms($p->id));
        $this->assertContains($p->name, $terms);
        $this->assertSame('dokter_gigi', app(UserDirectory::class)->licenseType($this->user('dokter@senyum.test')->id));
        $this->assertSame('lainnya', app(UserDirectory::class)->licenseType($this->user('pemilik@senyum.test')->id));
    }
}
