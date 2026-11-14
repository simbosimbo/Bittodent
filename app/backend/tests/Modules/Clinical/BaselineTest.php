<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\ToothBaseline;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class BaselineTest extends TestCase
{
    public function test_versioned_baseline_with_history_and_stale_check(): void
    {
        $p = $this->patientOf($this->tenantA())->id;
        $r = $this->as('dokter@senyum.test');
        $r->getJson("/api/patients/$p/baseline")->assertOk()->assertJsonPath('current.version', 1)->assertJsonPath('current.teeth.38', 'hilang');

        $r->putJson("/api/patients/$p/baseline", ['base_version' => 1, 'dentition' => 'tetap', 'teeth' => ['38' => 'hilang', '18' => 'hilang', '11' => 'ada']])
            ->assertCreated()->assertJsonPath('version', 2)->assertJsonMissingPath('teeth.11');
        $r->putJson("/api/patients/$p/baseline", ['base_version' => 1, 'dentition' => 'tetap', 'teeth' => []])->assertConflict();
        $r->putJson("/api/patients/$p/baseline", ['base_version' => 2, 'dentition' => 'x', 'teeth' => []])->assertUnprocessable();
        $r->putJson("/api/patients/$p/baseline", ['base_version' => 2, 'dentition' => 'tetap', 'teeth' => ['19' => 'hilang']])->assertUnprocessable();

        $h = $r->getJson("/api/patients/$p/baseline")->assertOk();
        $this->assertSame([2, 1], array_column($h->json('history'), 'version'));
        $this->assertSame('belum_tumbuh', $h->json('history.1.teeth.48')); // v1 untouched
        $this->assertSame(2, $r->getJson("/api/patients/$p/chart")->json('baseline.version'));
        $this->assertSame(2, Ctx::runAs($this->tenantA()->id, fn () => ToothBaseline::where('patient_id', $p)->count()));

        $this->as('depan@senyum.test')->putJson("/api/patients/$p/baseline", ['base_version' => 2, 'dentition' => 'tetap', 'teeth' => []])->assertForbidden();
    }
}
