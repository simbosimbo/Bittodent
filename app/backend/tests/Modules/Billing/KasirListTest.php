<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Audit\AuditEvent;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// GET /api/billing/invoices: Kasir worklist (DEVIATIONS #69). Open invoices of the ACTIVE branch + today's, billing readers only.
class KasirListTest extends TestCase
{
    use BilledVisit;

    private const URL = '/api/billing/invoices';

    public function test_billing_readers_see_open_and_todays_invoices_of_the_active_branch_with_names_and_balance(): void
    {
        [$visit, , $inv] = $this->billed();
        foreach ([self::OWNER, self::DESK, self::KASIR] as $email) {
            $res = $this->as($email)->getJson(self::URL)->assertOk()->assertJsonPath('date', CarbonImmutable::now('Asia/Jakarta')->toDateString());
            $row = collect($res->json('invoices'))->firstWhere('id', $inv);
            $this->assertNotNull($row, $email);
            $this->assertSame($visit, $row['visit_id']);
            $this->assertSame('terbuka', $row['status']);
            $this->assertNotEmpty($row['patient_name']);
            $this->assertGreaterThan(0, $row['balance_rp']);
            $this->assertContains($row['payer_type'], ['umum', 'asuransi', 'bpjs']);
            $this->assertNotEmpty($row['items']); // KL01 card: billed procedure names
        }
        $this->as(self::DOC)->getJson(self::URL)->assertForbidden();
        $this->as('asisten@senyum.test')->getJson(self::URL)->assertForbidden();
        $this->assertTrue($this->in($this->tenantA(), fn () => AuditEvent::where('action', 'baca')->where('entity_type', 'invoice_list')->exists()));
    }

    public function test_paid_today_stays_listed_as_lunas_and_other_branch_or_tenant_is_not_listed(): void
    {
        [, , $inv] = $this->billed();
        $balance = $this->as(self::KASIR)->getJson("/api/invoices/$inv")->json('balance_rp');
        $acct = $this->in($this->tenantA(), fn () => PaymentAccount::where('name', 'Kas Kemang')->value('id'));
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $acct, 'amount_rp' => $balance])
            ->assertCreated()->assertJsonPath('status', 'lunas');
        $row = collect($this->as(self::KASIR)->getJson(self::URL)->json('invoices'))->firstWhere('id', $inv);
        $this->assertSame('lunas', $row['status']);
        // KL03: BPJS / asuransi are payment methods (claims), owner can add them like any clinic account
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'BPJS uji', 'kind' => 'bpjs'])->assertCreated();
        $this->as(self::OWNER)->postJson('/api/payment-accounts', ['name' => 'Kartu', 'kind' => 'kartu'])->assertUnprocessable();
        $this->assertSame(0, $row['balance_rp']);

        $rawamangun = $this->in($this->tenantA(), fn () => Branch::where('name', 'like', 'Senyum Sehat Rawamangun%')->value('id'));
        $ids = collect($this->as(self::OWNER)->withSession(['branch_id' => $rawamangun])->getJson(self::URL)->assertOk()->json('invoices'))->pluck('id');
        $this->assertNotContains($inv, $ids);
        $this->assertNotContains($inv, collect($this->as('kasir@ceria.test')->getJson(self::URL)->assertOk()->json('invoices'))->pluck('id'));
        // an old open invoice (the seed's, created before today) is still listed: open = any day
        $old = $this->in($this->tenantA(), fn () => Invoice::where('status', 'terbuka')->where('created_at', '<', CarbonImmutable::now('Asia/Jakarta')->startOfDay()->utc())
            ->where('branch_id', Branch::where('name', 'like', 'Senyum Sehat Kemang%')->value('id'))->value('id'));
        if ($old) {
            $this->assertContains($old, collect($this->as(self::KASIR)->getJson(self::URL)->json('invoices'))->pluck('id'));
        }
    }
}
