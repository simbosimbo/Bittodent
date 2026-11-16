<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\Patient;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PatientApiTest extends TestCase
{
    public function test_front_desk_sees_masked_nik_dentist_sees_full(): void
    {
        $p = $this->patientOf($this->tenantA());
        $this->assertSame('************0001', $this->as('depan@senyum.test')->getJson("/api/patients/{$p->id}")->assertOk()->json('nik'));
        $this->assertSame('9901000000000001', $this->as('dokter@senyum.test')->getJson("/api/patients/{$p->id}")->assertOk()->json('nik'));
    }

    public function test_list_includes_status_but_no_sensitive_columns(): void
    {
        $row = $this->as('depan@senyum.test')->getJson('/api/patients')->assertOk()->json('data.0');
        $this->assertSame('aktif', $row['status']);
        $this->assertSame([], array_intersect(array_keys($row), ['nik', 'nik_enc', 'phone', 'phone_enc', 'address', 'address_enc']));
    }

    public function test_create_patient_encrypts_and_rejects_duplicates_with_id_only(): void
    {
        $r = $this->as('depan@senyum.test');
        $id = $r->postJson('/api/patients', ['name' => 'Rahmat Uji', 'nik' => '9909 1234 5678 0001', 'phone' => '0899 77 123456', 'address' => 'Jl. Fiktif 1'])
            ->assertCreated()->json('id');
        $row = DB::connection('mysql_admin')->table('patient')->where('id', $id)->first();
        $this->assertNull($row); // committed only inside the ehr_app transaction; admin cannot see it
        $raw = Ctx::runAs($this->tenantA()->id, fn () => Patient::find($id)->getAttributes());
        $this->assertStringNotContainsString('9909123456780001', $raw['nik_enc']);
        $this->assertStringNotContainsString('Fiktif', $raw['address_enc']);

        $dup = $r->postJson('/api/patients', ['name' => 'Orang Lain', 'nik' => '9909123456780001'])->assertStatus(409);
        $this->assertSame(['error' => 'duplicate', 'field' => 'nik', 'id' => $id], $dup->json());
        $r->postJson('/api/patients', ['name' => 'Orang Lain', 'phone' => '+62899 77 123456'])->assertStatus(409)->assertJsonPath('field', 'phone');
        $r->postJson('/api/patients', ['name' => '', 'nik' => '123'])->assertUnprocessable();
        $this->assertTrue(Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('entity_id', $id)->where('action', 'buat')->exists()));
    }
}
