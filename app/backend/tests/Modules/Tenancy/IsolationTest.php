<?php

namespace Tests\Modules\Tenancy;

use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Patients\Models\Patient;
use App\Modules\Scheduling\Models\Appointment;
use App\Shared\Tenancy\Ctx;
use RuntimeException;
use Tests\TestCase;

class IsolationTest extends TestCase
{
    public function test_global_scope_returns_only_current_tenant_rows(): void
    {
        $a = $this->tenantA()->id;
        $bPatient = $this->patientOf($this->tenantB());

        Ctx::runAs($a, function () use ($a, $bPatient) {
            foreach ([Patient::class, Appointment::class, ClinicalNoteVersion::class] as $model) {
                $rows = $model::all();
                $this->assertNotEmpty($rows, $model);
                $this->assertSame([$a], $rows->pluck('tenant_id')->unique()->values()->all(), $model);
            }
            $this->assertNull(Patient::find($bPatient->id));
        });
    }

    public function test_api_returns_404_for_other_tenant_patient(): void
    {
        $b = $this->patientOf($this->tenantB());
        $this->as('dokter@senyum.test')->getJson("/api/patients/{$b->id}")->assertNotFound();
        $this->as('dokter@senyum.test')->getJson("/api/patients/{$b->id}/chart")->assertNotFound();
    }

    public function test_creating_with_other_tenant_id_is_rejected_or_overridden(): void
    {
        $a = $this->tenantA()->id;
        $b = $this->tenantB()->id;
        Ctx::runAs($a, function () use ($a, $b) {
            // mass assignment: tenant_id is guarded, context wins
            $p = (new Patient)->fillIdentity(['name' => 'Uji Silang'])->fill(['tenant_id' => $b]);
            $p->save();
            $this->assertSame($a, $p->tenant_id);
            // explicit forceFill of another tenant: rejected
            $this->expectException(\LogicException::class);
            (new Patient)->fillIdentity(['name' => 'Uji Silang 2'])->forceFill(['tenant_id' => $b])->save();
        });
    }

    public function test_no_tenant_context_throws_instead_of_returning_all_rows(): void
    {
        $this->assertNull(Ctx::current()->tenantId);
        $this->expectException(RuntimeException::class);
        Patient::all();
    }
}
