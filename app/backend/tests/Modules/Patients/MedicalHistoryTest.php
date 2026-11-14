<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Patients\Models\Patient;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class MedicalHistoryTest extends TestCase
{
    private const BODY = ['medications' => ['Obat Contoh 5 mg'], 'problems' => ['Hipertensi (contoh)'], 'allergies' => ['Penisilin'],
        'urgent_note' => null, 'premedication_required' => false];

    public function test_versions_are_appended_never_overwritten(): void
    {
        $p = $this->patientOf($this->tenantA())->id;
        $r = $this->as('dokter@senyum.test');
        $r->getJson("/api/patients/$p/medical-history")->assertOk()->assertJsonPath('current.version', 2)
            ->assertJsonPath('current.premedication_required', true)->assertJsonCount(2, 'history');

        $r->putJson("/api/patients/$p/medical-history", self::BODY + ['base_version' => 2])->assertCreated()->assertJsonPath('version', 3);
        $r->putJson("/api/patients/$p/medical-history", self::BODY + ['base_version' => 2])->assertConflict(); // stale
        $h = $r->getJson("/api/patients/$p/medical-history")->assertOk();
        $this->assertSame([3, 2, 1], array_column($h->json('history'), 'version'));
        $this->assertSame(['Penisilin', 'Lateks'], $h->json('history.1.allergies')); // v2 kept as it was
        $this->assertFalse($h->json('current.premedication_required'));

        $raw = Ctx::runAs($this->tenantA()->id, fn () => MedicalHistoryVersion::where('patient_id', $p)->pluck('content_enc')->implode(''));
        $this->assertStringNotContainsString('Penisilin', $raw);
    }

    public function test_alerts_compact_set_by_role(): void
    {
        $p = $this->patientOf($this->tenantA())->id;
        $this->as('dokter@senyum.test')->getJson("/api/patients/$p/alerts")->assertOk()
            ->assertJsonPath('premedication_required', true)->assertJsonPath('allergies', ['Penisilin', 'Lateks'])
            ->assertJsonPath('problems', ['Katup jantung buatan (contoh)'])->assertJsonPath('full', true);
        // front desk: allergies + premed + "has urgent note", not the clinical text
        $this->as('depan@senyum.test')->getJson("/api/patients/$p/alerts")->assertOk()->assertJsonPath('allergies', ['Penisilin', 'Lateks'])
            ->assertJsonPath('has_urgent_note', true)->assertJsonMissingPath('urgent_note')->assertJsonMissingPath('medications');
        $this->as('depan@senyum.test')->getJson("/api/patients/$p/medical-history")->assertForbidden();
        $this->as('depan@senyum.test')->putJson("/api/patients/$p/medical-history", self::BODY + ['base_version' => 2])->assertForbidden();
        $other = Ctx::runAs($this->tenantA()->id, fn () => Patient::orderBy('created_at')->skip(3)->firstOrFail()->id);
        $this->as('dokter@senyum.test')->getJson("/api/patients/$other/alerts")->assertOk()->assertJsonPath('version', null)->assertJsonPath('allergies', []);
    }
}
