<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\Payment;
use App\Modules\Billing\Services\PaymentService;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

// Seed (DatabaseSeeder::paymentDemo): Kemang today 300000 + 150000; Kemang yesterday 100000; Rawamangun today 200000; Ceria today 175000.
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
        return $this->inA(fn () => Invoice::orderBy('created_at')->firstOrFail()); // C3: 250000 - 25000, no payments
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

    public function test_write_off_is_not_revenue_and_payment_is(): void
    {
        $inv = $this->seedInvoice();
        $owner = $this->as('pemilik@senyum.test');
        $owner->postJson("/api/invoices/{$inv->id}/adjustments", ['kind' => 'write_off', 'amount_rp' => 25000, 'reason' => 'Penghapusan uji'])->assertCreated();
        $owner->getJson(self::URL)->assertJsonPath('amount_rp', 450000)->assertJsonPath('payment_count', 2);

        $this->inA(fn () => app(PaymentService::class)->record($inv->id, 200000, 'qris'));
        $owner->getJson(self::URL)->assertJsonPath('amount_rp', 650000)->assertJsonPath('payment_count', 3);
        $owner->getJson("/api/invoices/{$inv->id}")->assertJsonPath('payments_rp', 200000)->assertJsonPath('balance_rp', 0)->assertJsonPath('status', 'lunas');
    }

    public function test_payment_rules(): void
    {
        $inv = $this->seedInvoice();
        $pay = fn (int $amount, string $method = 'tunai') => $this->inA(fn () => app(PaymentService::class)->record($inv->id, $amount, $method));
        foreach ([[225001, 'tunai'], [0, 'tunai'], [-1, 'tunai'], [1000, 'cek']] as [$amount, $method]) {
            try {
                $pay($amount, $method);
                $this->fail("accepted $amount/$method");
            } catch (ValidationException) {
            }
        }
        $pay(100000);
        $this->assertSame('terbuka', $this->inA(fn () => $inv->fresh()->status));
        $pay(125000, 'kartu');
        $this->assertSame('lunas', $this->inA(fn () => $inv->fresh()->status));
        $this->assertSame(1, $this->inA(fn () => \App\Shared\Audit\AuditEvent::where('action', 'bayar')->where('entity_id', $inv->id)
            ->where('detail->amount_rp', 125000)->count()));

        // a negative correction re-opens it; the cash already taken still counts
        $this->as('pemilik@senyum.test')->postJson("/api/invoices/{$inv->id}/adjustments", ['kind' => 'correction', 'amount_rp' => -5000, 'reason' => 'Koreksi uji'])
            ->assertCreated()->assertJsonPath('balance_rp', 5000)->assertJsonPath('status', 'terbuka');
        $this->as('kasir@senyum.test')->getJson(self::URL)->assertJsonPath('amount_rp', 675000)->assertJsonPath('payment_count', 4);
    }

    public function test_branch_outside_membership_is_denied(): void
    {
        $inv = $this->seedInvoice();
        $ctx = Ctx::current();
        $ctx->branchIds = [$this->branch('Senyum Sehat Rawamangun')];
        try {
            $this->inA(fn () => app(PaymentService::class)->record($inv->id, 1000, 'tunai'));
            $this->fail('accepted a payment outside the membership');
        } catch (HttpResponseException $e) {
            $this->assertSame(403, $e->getResponse()->getStatusCode());
        } finally {
            $ctx->branchIds = null;
        }
        $this->assertSame(0, $this->inA(fn () => Payment::where('invoice_id', $inv->id)->count()));
    }
}
