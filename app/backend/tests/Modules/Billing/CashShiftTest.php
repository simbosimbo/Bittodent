<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\CashShift;
use App\Modules\Billing\Models\PaymentAccount;
use Illuminate\Database\QueryException;
use Tests\TestCase;

// Board KL06: cashier shift. Recap per method/bank from the cashier's own payments; a cash difference needs a reason; closed = frozen.
class CashShiftTest extends TestCase
{
    use BilledVisit;

    public function test_open_pay_and_close_with_a_reasoned_difference(): void
    {
        [, , $inv] = $this->billed();
        $r = $this->as(self::KASIR);
        $r->getJson('/api/cash-shift/current')->assertOk()->assertJsonPath('shift', null);
        $id = $r->postJson('/api/cash-shift', ['opening_cash_rp' => 100000])->assertCreated()->json('shift.id');
        $r->postJson('/api/cash-shift', ['opening_cash_rp' => 5])->assertStatus(409); // one open shift per cashier per branch

        $balance = $r->getJson("/api/invoices/$inv")->json('balance_rp');
        [$cash, $bca] = $this->in($this->tenantA(), fn () => [PaymentAccount::where('name', 'Kas Kemang')->value('id'), PaymentAccount::where('name', 'EDC BCA klinik')->value('id')]);
        $r->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $cash, 'amount_rp' => 1000])->assertCreated();
        $r->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $bca, 'amount_rp' => $balance - 1000])->assertCreated();

        $cur = $r->getJson('/api/cash-shift/current')->assertOk();
        $cur->assertJsonPath('shift.cash_in_rp', 1000)->assertJsonPath('shift.expected_cash_rp', 101000)->assertJsonPath('shift.total_rp', $balance);
        $this->assertSame([['tunai', null, 1000], ['edc', 'BCA', $balance - 1000]],
            collect($cur->json('shift.methods'))->map(fn ($m) => [$m['kind'], $m['bank_name'], $m['amount_rp']])->all());

        $this->as(self::DESK)->postJson("/api/cash-shift/$id/close", ['counted_cash_rp' => 101000])->assertForbidden(); // not their shift
        $r = $this->as(self::KASIR);
        $r->postJson("/api/cash-shift/$id/close", ['counted_cash_rp' => 91000])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $r->postJson("/api/cash-shift/$id/close", ['counted_cash_rp' => 91000, 'reason' => 'Kembalian salah hitung'])->assertOk()
            ->assertJsonPath('shift.difference_rp', -10000)->assertJsonPath('shift.expected_cash_rp', 101000);
        $r->postJson("/api/cash-shift/$id/close", ['counted_cash_rp' => 101000])->assertStatus(409);
        $r->getJson('/api/cash-shift/current')->assertJsonPath('shift', null);

        $this->expectException(QueryException::class); // closed shift is frozen at the database too
        $this->in($this->tenantA(), fn () => CashShift::findOrFail($id)->update(['difference_rp' => 0]));
    }

    public function test_doctor_has_no_shift(): void
    {
        $this->as(self::DOC)->getJson('/api/cash-shift/current')->assertForbidden();
        $this->as(self::DOC)->postJson('/api/cash-shift', ['opening_cash_rp' => 0])->assertForbidden();
    }
}
