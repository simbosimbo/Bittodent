<?php

namespace Tests\Modules\Reporting;

use App\Modules\Billing\Models\PaymentAccount;
use Tests\Modules\Billing\BilledVisit;
use Tests\TestCase;

// Boards KL07-KL09: owner-only revenue report of the active branch. Money received, per method/bank, per dokter, piutang, shift differences.
class RevenueReportTest extends TestCase
{
    use BilledVisit;

    private const URL = '/api/reports/revenue';

    public function test_owner_sees_revenue_by_method_doctor_receivables_and_shift_difference(): void
    {
        $before = $this->as(self::OWNER)->getJson(self::URL.'?period=today')->assertOk()->json();
        [, , $inv] = $this->billed();
        $owed = $this->as(self::OWNER)->getJson(self::URL.'?period=today')->json();
        $balance = $this->as(self::KASIR)->getJson("/api/invoices/$inv")->json('balance_rp');
        $this->assertSame($before['receivable_rp'] + $balance, $owed['receivable_rp']);
        $this->assertNotEmpty(collect($owed['by_doctor'])->whereNotNull('doctor_id')->where('name', '!=', 'Tanpa dokter')->all()); // line.doctor_id + name

        $k = $this->as(self::KASIR);
        $shift = $k->postJson('/api/cash-shift', ['opening_cash_rp' => 0])->json('shift.id');
        $bca = $this->in($this->tenantA(), fn () => PaymentAccount::where('name', 'EDC BCA klinik')->value('id'));
        $k->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $bca, 'amount_rp' => $balance])->assertCreated();
        $k->postJson("/api/cash-shift/$shift/close", ['counted_cash_rp' => 0])->assertOk();
        $this->as(self::KASIR)->postJson('/api/cash-shift', ['opening_cash_rp' => 50000]);
        $s2 = $this->as(self::KASIR)->getJson('/api/cash-shift/current')->json('shift.id');
        $this->as(self::KASIR)->postJson("/api/cash-shift/$s2/close", ['counted_cash_rp' => 40000, 'reason' => 'Uang kurang uji'])->assertOk();

        $r = $this->as(self::OWNER)->getJson(self::URL.'?period=today')->assertOk()->json();
        $this->assertSame($before['revenue_rp'] + $balance, $r['revenue_rp']);
        $this->assertSame($before['transactions'] + 1, $r['transactions']);
        $this->assertSame($before['receivable_rp'], $r['receivable_rp']); // paid off
        $edc = collect($r['by_method'])->first(fn ($m) => $m['kind'] === 'edc' && $m['bank_name'] === 'BCA');
        $this->assertGreaterThanOrEqual($balance, $edc['amount_rp']);
        $this->assertCount(7, $r['daily']);
        $this->assertSame(-10000, collect($r['shift_differences'])->last()['difference_rp']);
        $this->assertSame('Uang kurang uji', collect($r['shift_differences'])->last()['reason']);
    }

    public function test_only_the_owner_reads_it_and_period_is_validated(): void
    {
        foreach ([self::KASIR, self::DESK, self::DOC] as $email) {
            $this->as($email)->getJson(self::URL)->assertForbidden();
        }
        $this->as(self::OWNER)->getJson(self::URL.'?period=year')->assertUnprocessable();
        $this->as(self::OWNER)->getJson(self::URL)->assertOk()->assertJsonPath('period', 'month');
    }
}
