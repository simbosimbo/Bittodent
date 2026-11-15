<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\PaymentAccount;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

// Unit 5 (DEVIATIONS #51): payments only into clinic-owned accounts (no free-text rekening); split; never above the balance.
class PaymentTest extends TestCase
{
    private const KASIR = 'kasir@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function invoice(): string
    {
        return $this->inA(fn () => Invoice::orderBy('created_at')->value('id')); // Kemang, 250000 - 25000 = 225000
    }

    private function account(string $name, ?string $tenant = null): string
    {
        return Ctx::runAs($tenant ?? $this->tenantA()->id, fn () => PaymentAccount::where('name', $name)->value('id'));
    }

    private function pay(string $inv, array $body, string $as = self::KASIR)
    {
        return $this->as($as)->postJson("/api/invoices/$inv/payments", $body);
    }

    private function payments(): int
    {
        return $this->inA(fn () => InvoicePayment::count());
    }

    public function test_split_across_two_clinic_accounts_until_lunas_then_overpay_is_rejected(): void
    {
        $inv = $this->invoice();
        $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 100000])->assertCreated()
            ->assertJsonPath('payments_rp', 100000)->assertJsonPath('balance_rp', 125000)->assertJsonPath('status', 'terbuka');
        $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 125001])->assertUnprocessable()
            ->assertJsonPath('error', 'overpay');
        $this->pay($inv, ['payment_account_id' => $this->account('QRIS klinik'), 'amount_rp' => 125000])->assertCreated()
            ->assertJsonPath('balance_rp', 0)->assertJsonPath('status', 'lunas')
            ->assertJsonPath('payments.0.account.kind', 'tunai')->assertJsonPath('payments.1.account.name', 'QRIS klinik');
        $this->pay($inv, ['payment_account_id' => $this->account('QRIS klinik'), 'amount_rp' => 1])->assertUnprocessable();
        $this->as(self::KASIR)->getJson("/api/invoices/$inv")->assertOk()->assertJsonCount(2, 'payments')->assertJsonPath('status', 'lunas');
        $this->assertSame(2, $this->inA(fn () => AuditEvent::where('action', 'pembayaran')->where('entity_id', $inv)->count()));
    }

    public function test_only_an_active_clinic_account_of_this_tenant_and_branch_is_accepted(): void
    {
        $inv = $this->invoice();
        $this->as(self::OWNER)->patchJson('/api/payment-accounts/'.$this->account('EDC BCA klinik'), ['is_active' => false])->assertOk()
            ->assertJsonPath('is_active', false);
        foreach ([
            'missing' => null,
            'unknown' => (string) Str::uuid(),
            'other tenant' => $this->account('Kas Dago', $this->tenantB()->id),
            'inactive' => $this->account('EDC BCA klinik'),
            'other branch' => $this->account('Kas Rawamangun'),
        ] as $case => $acc) {
            $this->pay($inv, ['payment_account_id' => $acc, 'amount_rp' => 1000])->assertUnprocessable()
                ->assertJsonValidationErrors('payment_account_id');
        }
        $this->assertSame(0, $this->payments());
    }

    public function test_a_typed_destination_account_is_rejected_and_never_stored(): void
    {
        $inv = $this->invoice();
        foreach (['rekening', 'account_number', 'bank_account', 'destination', 'nomor_rekening'] as $field) {
            $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 1000, $field => '1234567890'])
                ->assertUnprocessable()->assertJsonPath('error', 'unknown_fields')->assertJsonValidationErrors($field);
        }
        $this->assertSame(0, $this->payments());
        $this->assertSame([], array_intersect(Schema::connection('mysql_admin')->getColumnListing('invoice_payment'),
            ['rekening', 'account_number', 'bank_account', 'destination']));
        // the owner cannot sneak a full number into the master data either (last 4 digits only)
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'Transfer X', 'kind' => 'transfer', 'account_number' => '1234567890'])
            ->assertUnprocessable();
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'Transfer X', 'kind' => 'transfer', 'account_last4' => '1234567890'])
            ->assertUnprocessable()->assertJsonValidationErrors('account_last4');
    }

    public function test_pending_full_discount_does_not_reduce_the_balance_and_cannot_be_approved_after_payment(): void
    {
        $inv = $this->invoice();
        $pending = $this->as('depan@senyum.test')->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 225000,
            'reason' => 'Diskon penuh uji'])->assertStatus(202)->json('adjustments.1.id');
        $this->pay($inv, ['payment_account_id' => $this->account('Transfer BCA klinik'), 'amount_rp' => 225000])->assertCreated()
            ->assertJsonPath('balance_rp', 0)->assertJsonPath('status', 'lunas')->assertJsonPath('payments.0.account.account_last4', '0123');
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$pending/approve")->assertUnprocessable()->assertJsonPath('error', 'negative_balance');
    }

    public function test_approved_full_discount_marks_lunas_and_a_correction_reopens(): void
    {
        $inv = $this->invoice();
        $id = $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 225000,
            'reason' => 'Diskon penuh uji'])->assertStatus(202)->json('adjustments.1.id');
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$id/approve")->assertOk()->assertJsonPath('status', 'lunas');
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'correction', 'amount_rp' => -5000,
            'reason' => 'Koreksi uji naik', 'invoice_line_id' => $this->as(self::KASIR)->getJson("/api/invoices/$inv")->json('lines.0.id')])->assertCreated()->assertJsonPath('balance_rp', 5000)->assertJsonPath('status', 'terbuka');
    }

    public function test_payments_are_append_only_and_accounts_are_never_deleted(): void
    {
        $inv = $this->invoice();
        $key = (string) Str::uuid();
        $body = ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 5000, 'request_key' => $key];
        $this->pay($inv, $body)->assertCreated();
        $this->pay($inv, $body)->assertOk()->assertJsonCount(1, 'payments'); // resend: no second payment
        $this->assertSame(1, $this->payments());
        $this->assertThrows(fn () => $this->inA(fn () => InvoicePayment::query()->update(['amount_rp' => 1])), QueryException::class);
        $this->assertThrows(fn () => $this->inA(fn () => InvoicePayment::query()->delete()), QueryException::class);
        $this->assertThrows(fn () => $this->inA(fn () => PaymentAccount::where('name', 'Kas Kemang')->delete()), QueryException::class);
    }

    public function test_roles_who_pays_and_who_manages_accounts(): void
    {
        $inv = $this->invoice();
        foreach (['dokter@senyum.test', 'asisten@senyum.test'] as $who) {
            $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 1000], $who)->assertForbidden();
        }
        $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 1000], 'depan@senyum.test')->assertCreated();
        $this->pay($inv, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 1000], self::OWNER)->assertCreated();

        $new = ['name' => 'Transfer Mandiri klinik', 'kind' => 'transfer', 'bank_name' => 'Mandiri', 'account_last4' => '4321'];
        foreach (['dokter@senyum.test', 'depan@senyum.test', self::KASIR] as $who) {
            $this->as($who)->postJson('/api/payment-accounts', $new)->assertForbidden();
            $this->as($who)->patchJson('/api/payment-accounts/'.$this->account('QRIS klinik'), ['is_active' => false])->assertForbidden();
        }
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'Cek', 'kind' => 'cek'])->assertUnprocessable()->assertJsonValidationErrors('kind');
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'Kas lain', 'kind' => 'tunai',
            'branch_id' => Ctx::runAs($this->tenantB()->id, fn () => PaymentAccount::value('branch_id'))])->assertUnprocessable();
        $id = $this->as(self::OWNER)->postJson('/api/payment-accounts', $new)->assertCreated()->assertJsonPath('branch_id', null)->json('id');
        $this->as(self::OWNER)->patchJson("/api/payment-accounts/$id", ['kind' => 'tunai'])->assertUnprocessable(); // kind is fixed
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'akun_bayar_dibuat')->where('entity_id', $id)->exists()));

        $list = $this->as(self::KASIR)->getJson('/api/payment-accounts')->assertOk()->json();
        $this->assertContains('Transfer Mandiri klinik', array_column($list, 'name'));
        $this->assertNotContains('Kas Dago', array_column($list, 'name')); // tenant B's
        $this->assertNotContains('Kas Rawamangun', array_column($list, 'name')); // kasir works in Kemang only
    }

    public function test_tenant_isolation(): void
    {
        $b = $this->tenantB()->id;
        $invB = Ctx::runAs($b, fn () => Invoice::value('id'));
        $this->pay($invB, ['payment_account_id' => $this->account('Kas Kemang'), 'amount_rp' => 1000])->assertNotFound();
        $this->pay($invB, ['payment_account_id' => $this->account('Kas Dago', $b), 'amount_rp' => 1000])->assertNotFound();
        $this->as(self::OWNER)->patchJson('/api/payment-accounts/'.$this->account('Kas Dago', $b), ['is_active' => false])->assertNotFound();
        $this->as('kasir@ceria.test')->postJson("/api/invoices/$invB/payments", ['payment_account_id' => $this->account('QRIS klinik'),
            'amount_rp' => 1000])->assertUnprocessable();
        $this->as('kasir@ceria.test')->postJson("/api/invoices/$invB/payments", ['payment_account_id' => $this->account('Kas Dago', $b),
            'amount_rp' => 1000])->assertCreated();
    }
}
