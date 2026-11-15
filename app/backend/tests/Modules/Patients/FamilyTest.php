<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\Guardian;
use App\Modules\Patients\Models\Patient;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class FamilyTest extends TestCase
{
    private function minor(): Patient
    {
        return Ctx::runAs($this->tenantA()->id, fn () => Patient::where('name', 'Nadia Anak Contoh')->firstOrFail());
    }

    public function test_household_guarantor_and_guardian_view(): void
    {
        $p0 = $this->patientOf($this->tenantA());
        $minor = $this->minor();
        $f = $this->as('depan@senyum.test')->getJson("/api/patients/{$minor->id}/family")->assertOk()
            ->assertJsonPath('is_minor', true)->assertJsonPath('guarantor.id', $p0->id)
            ->assertJsonPath('guardians.0.relationship', 'ibu')->assertJsonPath('guardians.0.guardian_patient_id', $p0->id);
        $this->assertCount(2, $f->json('household.members'));
        $this->assertSame('9901********0001', $f->json('guardians.0.nik')); // masked for everyone (A4)
        $this->assertSame('9901********0001', $this->as('dokter@senyum.test')->getJson("/api/patients/{$minor->id}/family")->json('guardians.0.nik'));
        $this->as('depan@senyum.test')->getJson("/api/patients/{$p0->id}/family")->assertOk()->assertJsonPath('is_minor', false)->assertJsonPath('guarantor', null);
    }

    public function test_update_family_rules(): void
    {
        $p0 = $this->patientOf($this->tenantA());
        $other = Ctx::runAs($this->tenantA()->id, fn () => Patient::orderBy('created_at')->skip(2)->firstOrFail());
        $r = $this->as('depan@senyum.test');
        $r->putJson("/api/patients/{$other->id}/family", ['guarantor_id' => $other->id])->assertUnprocessable();
        $r->putJson("/api/patients/{$other->id}/family", ['guarantor_id' => $this->minor()->id])->assertUnprocessable(); // minor cannot pay
        $r->putJson("/api/patients/{$other->id}/family", ['household_name' => 'Keluarga Baru (uji)', 'guarantor_id' => $p0->id])
            ->assertOk()->assertJsonPath('guarantor.id', $p0->id)->assertJsonPath('household.name', 'Keluarga Baru (uji)');
        // chains are refused: someone guaranteed by $other's guarantor chain must point to the top payer
        $r->putJson("/api/patients/{$p0->id}/family", ['guarantor_id' => $other->id])->assertUnprocessable();
        $r->putJson("/api/patients/{$other->id}/family", ['guarantor_id' => null])->assertOk()->assertJsonPath('guarantor', null);
        $this->as('asisten@senyum.test')->putJson("/api/patients/{$other->id}/family", ['guarantor_id' => null])->assertForbidden();
    }

    public function test_guardian_identifiers_are_encrypted_like_patient(): void
    {
        $minor = $this->minor();
        $id = $this->as('depan@senyum.test')->postJson("/api/patients/{$minor->id}/guardians",
            ['name' => 'Bapak Uji Contoh', 'relationship' => 'ayah', 'nik' => '9901 0000 0000 0777', 'phone' => '0899-0100-0777'])
            ->assertCreated()->assertJsonPath('nik', '9901********0777')->json('id');
        $g = Ctx::runAs($this->tenantA()->id, fn () => Guardian::findOrFail($id));
        $this->assertStringNotContainsString('0777', $g->nik_enc.$g->phone_enc);
        $this->assertSame(Crypto::blindIndex('9901000000000777'), $g->nik_bidx);
        $this->assertSame(Crypto::blindIndex('6289901000777'), $g->phone_bidx);
        $this->as('depan@senyum.test')->postJson("/api/patients/{$minor->id}/guardians", ['name' => 'X', 'relationship' => 'tetangga'])->assertUnprocessable();
    }

    public function test_consent_for_minor_must_reference_their_guardian(): void
    {
        $minor = $this->minor();
        $guardian = Ctx::runAs($this->tenantA()->id, fn () => Guardian::where('patient_id', $minor->id)->firstOrFail());
        $foreign = Ctx::runAs($this->tenantA()->id, fn () => Guardian::create(['patient_id' => $this->patientOf($this->tenantA())->id, 'name' => 'Wali Lain', 'relationship' => 'wali_lain']));
        $body = ['kind' => 'tindakan_invasif', 'document_hash' => hash('sha256', 'dok'), 'witness_name' => 'Saksi Contoh', 'device' => 'Tablet uji'];
        $r = $this->as('asisten@senyum.test');
        $r->postJson("/api/patients/{$minor->id}/consents", $body + ['signer' => 'pasien'])->assertUnprocessable();
        $r->postJson("/api/patients/{$minor->id}/consents", $body + ['signer' => 'wali', 'guardian_id' => $foreign->id])->assertUnprocessable();
        $r->postJson("/api/patients/{$minor->id}/consents", $body + ['signer' => 'wali', 'guardian_id' => $guardian->id])
            ->assertCreated()->assertJsonPath('guardian_id', $guardian->id);
        $this->as('depan@senyum.test')->postJson("/api/patients/{$minor->id}/consents", $body + ['signer' => 'wali', 'guardian_id' => $guardian->id])->assertForbidden();
    }
}
