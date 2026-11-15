<?php

namespace Tests\Modules\Tenancy;

use App\Modules\Tenancy\Models\Branch;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

// Pengaturan Klinik > Profil (DEVIATIONS #71): clinic name/contact/licence + branch address; owner only (settings.manage), audited.
class ClinicProfileTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    public function test_owner_edits_profile_and_me_shows_the_address(): void
    {
        $this->as(self::OWNER)->getJson('/api/settings/clinic')->assertOk()->assertJsonPath('address', null)->assertJsonStructure(['branches' => [['id', 'name', 'address', 'phone']]]);
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['address' => ' Jl. Contoh No. 1, Jakarta ', 'phone' => '021-5550101',
            'email' => 'klinik@contoh.test', 'license_no' => 'IZIN-CONTOH-001', 'license_valid_until' => '2030-12-31'])->assertOk()
            ->assertJsonPath('address', 'Jl. Contoh No. 1, Jakarta')->assertJsonPath('license_valid_until', '2030-12-31')
            ->assertJsonPath('correction_window_hours', 48);
        $this->as('kasir@senyum.test')->getJson('/api/me')->assertOk()->assertJsonPath('active.address', 'Jl. Contoh No. 1, Jakarta');
        $audit = Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('action', 'ubah_pengaturan')->where('entity_type', 'tenant')->get());
        $this->assertEqualsCanonicalizing(['address', 'phone', 'email', 'license_no', 'license_valid_until'], $audit->pluck('detail.field')->all());
        // the other clinic is untouched
        $this->as('dokter@ceria.test')->getJson('/api/me')->assertOk()->assertJsonPath('active.address', null);
    }

    public function test_branch_address_wins_and_is_scoped(): void
    {
        $b = Ctx::runAs($this->tenantA()->id, fn () => Branch::orderBy('name')->firstOrFail());
        $this->as(self::OWNER)->putJson("/api/settings/branches/{$b->id}", ['address' => 'Jl. Cabang Contoh 2', 'phone' => '0812 0000 0000'])->assertOk()
            ->assertJsonPath('address', 'Jl. Cabang Contoh 2');
        $this->assertTrue(Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('entity_type', 'branch')->where('entity_id', $b->id)->exists()));
        $this->as('dokter@ceria.test')->putJson("/api/settings/branches/{$b->id}", ['address' => 'x'])->assertNotFound();
    }

    public function test_validation_and_rbac(): void
    {
        $this->as(self::OWNER)->putJson('/api/settings/clinic', [])->assertUnprocessable();
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['name' => ' '])->assertUnprocessable();
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['email' => 'bukan-email'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['phone' => 'abc'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        foreach (['dokter@senyum.test', 'kasir@senyum.test', 'depan@senyum.test', 'asisten@senyum.test'] as $who) {
            $this->as($who)->putJson('/api/settings/clinic', ['address' => 'x'])->assertForbidden();
        }
    }
}
