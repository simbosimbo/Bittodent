<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// Seed (DatabaseSeeder::paymentDemo, invoice_payment): Kemang today 300000 + 150000; Kemang yesterday 100000; Rawamangun today 200000; Ceria today 175000.
class DailyRevenueTest extends TestCase
{
    private const URL = '/api/billing/daily-revenue';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn, $this->user('pemilik@senyum.test')->id);
    }

    private function branch(string $prefix): string
    {
        return $this->inA(fn () => Branch::where('name', 'like', "$prefix%")->firstOrFail()->id);
    }

    private function seedInvoice(): Invoice
    {
        return $this->inA(fn () => Invoice::orderBy('created_at')->firstOrFail()); // C3 (Kemang): 250000 - 25000, no payments
    }

    private function pay(string $inv, string $account, int $amount)
    {
        $id = $this->inA(fn () => PaymentAccount::where('name', $account)->value('id'));

        return $this->as('kasir@senyum.test')->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $id, 'amount_rp' => $amount]);
    }

    public function test_only_billing_readers_see_the_active_branch_total_for_today(): void
    {
        $kemang = $this->branch('Senyum Sehat Kemang');
        foreach (['pemilik@senyum.test', 'depan@senyum.test', 'kasir@senyum.test'] as $email) {
            $this->as($email)->getJson(self::URL)->assertOk()->assertExactJson([
                'date' => CarbonImmutable::now('Asia/Jakarta')->toDateString(), 'branch_id' => $kemang, 'amount_rp' => 450000, 'payment_count' => 2]);
        }
        $this->as('dokter@senyum.test')->getJson(self::URL)->assertForbidden();
        $this->as('asisten@senyum.test')->getJson(self::URL)->assertForbidden();
    }

    public function test_other_branch_and_other_tenant_are_separate(): void
    {
        $rawamangun = $this->branch('Senyum Sehat Rawamangun');
        // owner covers every branch but sees the ACTIVE one only
        $this->as('pemilik@senyum.test')->withSession(['branch_id' => $rawamangun])->getJson(self::URL)->assertOk()
            ->assertJsonPath('branch_id', $rawamangun)->assertJsonPath('amount_rp', 200000)->assertJsonPath('payment_count', 1);
        $this->as('kasir@ceria.test')->getJson(self::URL)->assertOk()->assertJsonPath('amount_rp', 175000)->assertJsonPath('payment_count', 1);
    }

    public function test_write_off_is_not_revenue_and_each_payment_is(): void
    {
        $inv = $this->seedInvoice()->id;
        $owner = $this->as('pemilik@senyum.test');
        $owner->postJson("/api/invoices/$inv/adjustments", ['kind' => 'write_off', 'amount_rp' => 25000, 'reason' => 'Penghapusan uji'])->assertCreated();
        $owner->getJson(self::URL)->assertJsonPath('amount_rp', 450000)->assertJsonPath('payment_count', 2);

        $this->pay($inv, 'Kas Kemang', 120000)->assertCreated();
        $this->pay($inv, 'QRIS klinik', 80000)->assertCreated()->assertJsonPath('balance_rp', 0)->assertJsonPath('status', 'lunas');
        $owner->getJson(self::URL)->assertJsonPath('amount_rp', 650000)->assertJsonPath('payment_count', 4);
        $this->pay($inv, 'QRIS klinik', 1)->assertUnprocessable(); // overpay: no revenue
        $owner->getJson(self::URL)->assertJsonPath('amount_rp', 650000);
    }
}
