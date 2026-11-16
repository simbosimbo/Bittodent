<?php

namespace Tests\Modules\Tenancy;

use App\Modules\Billing\Models\PaymentAccount;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// Boards KL10-KL13: one clinic logo + NPWP + receipt paper (owner), kop readable by every clinic role; static QRIS photo per QRIS account.
class ClinicLetterheadTest extends TestCase
{
    public function test_owner_sets_logo_npwp_paper_and_every_role_reads_the_letterhead(): void
    {
        Storage::fake('local');
        $o = $this->as('pemilik@senyum.test');
        $o->putJson('/api/settings/clinic', ['npwp' => '10.0.1.3-012.000', 'receipt_paper_mm' => 58])->assertOk()
            ->assertJsonPath('npwp', '10.0.1.3-012.000')->assertJsonPath('receipt_paper_mm', 58);
        $o->putJson('/api/settings/clinic', ['receipt_paper_mm' => 70])->assertUnprocessable();
        $o->postJson('/api/settings/clinic/logo', ['logo' => UploadedFile::fake()->create('logo.svg', 2, 'image/svg+xml')])->assertUnprocessable(); // no SVG
        $o->postJson('/api/settings/clinic/logo', ['logo' => UploadedFile::fake()->image('logo.png', 300, 300)])->assertOk()->assertJsonPath('has_logo', true);

        $k = $this->as('kasir@senyum.test');
        $k->postJson('/api/settings/clinic/logo', ['logo' => UploadedFile::fake()->image('x.png')])->assertForbidden();
        $k->getJson('/api/clinic/letterhead')->assertOk()->assertJsonPath('has_logo', true)->assertJsonPath('npwp', '10.0.1.3-012.000')
            ->assertJsonPath('receipt_paper_mm', 58)->assertJsonMissingPath('license_valid_until');
        $k->get('/api/clinic/logo')->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->as('kasir@ceria.test')->get('/api/clinic/logo')->assertNotFound(); // other tenant has no logo, never ours
    }

    public function test_qris_photo_only_on_qris_accounts_and_readable_by_the_cashier(): void
    {
        Storage::fake('local');
        [$qris, $cash] = Ctx::runAs($this->tenantA()->id, fn () => [PaymentAccount::where('kind', 'qris')->value('id'), PaymentAccount::where('name', 'Kas Kemang')->value('id')]);
        $o = $this->as('pemilik@senyum.test');
        $o->postJson("/api/payment-accounts/$cash/qris-image", ['image' => UploadedFile::fake()->image('q.png')])->assertUnprocessable();
        $o->postJson("/api/payment-accounts/$qris/qris-image", ['image' => UploadedFile::fake()->image('q.png')])->assertOk()->assertJsonPath('has_qris_image', true);
        $this->as('kasir@senyum.test')->postJson("/api/payment-accounts/$qris/qris-image", ['image' => UploadedFile::fake()->image('q.png')])->assertForbidden();
        $this->as('kasir@senyum.test')->get("/api/payment-accounts/$qris/qris-image")->assertOk();
        $this->as('kasir@ceria.test')->get("/api/payment-accounts/$qris/qris-image")->assertNotFound(); // tenant-scoped
    }
}
