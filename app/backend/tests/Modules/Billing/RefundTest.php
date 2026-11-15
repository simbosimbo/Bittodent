<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Unit C koreksi (DEVIATIONS #57): refund = own row back to the original payment's clinic account, allocated to an applied credit
// note, always owner-approved. The original payment row never changes.
class RefundTest extends TestCase
{
    use BilledVisit;

    private function account(string $name): string
    {
        return $this->in($this->tenantA(), fn () => PaymentAccount::where('name', $name)->value('id'));
    }

    private function pay(string $inv, int $amount, string $account = 'QRIS klinik'): string
    {
        $payments = $this->as(self::KASIR)->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $this->account($account),
            'amount_rp' => $amount])->assertCreated()->json('payments');

        return collect($payments)->where('payment_account_id', $this->account($account))->last()['id'];
    }

    private function refund(string $inv, string $payment, string $note, int $amount, array $extra = [], string $as = self::KASIR)
    {
        return $this->as($as)->postJson("/api/invoices/$inv/refunds", $extra + ['payment_id' => $payment, 'credit_note_id' => $note,
            'amount_rp' => $amount, 'reason' => 'Pasien sudah bayar, tindakan dikoreksi']);
    }

    private function paymentRow(string $id): array
    {
        return $this->in($this->tenantA(), fn () => InvoicePayment::findOrFail($id)->getRawOriginal());
    }

    public function test_paid_work_corrected_to_not_done_goes_credit_note_then_refund_and_the_payment_stays(): void
    {
        [$visit, $proc, $inv, $unbilled] = $this->billed(open: true); // signed, still open (unbilled second row)
        $price = $this->invoice($inv)['lines'][0]['price_rp'];
        $pay = $this->pay($inv, $price);
        $before = $this->paymentRow($pay);
        $this->assertSame('lunas', $this->invoice($inv)['status']);

        $this->correct($proc, ['reason_type' => 'tidak_dikerjakan'])->assertCreated();
        $nk = $this->invoice($inv)['credit_notes'][0];
        $this->assertSame([true, 'pending'], [$nk['is_full'], $nk['status']]);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict(); // pending credit note blocks
        $this->refund($inv, $pay, $nk['id'], $price)->assertUnprocessable()->assertJsonValidationErrors('credit_note_id'); // not applied yet

        // approving the credit note on a paid invoice is allowed: the balance goes negative = kelebihan bayar
        $this->as(self::OWNER)->postJson("/api/credit-notes/{$nk['id']}/approve")->assertOk()
            ->assertJsonPath('balance_rp', -$price)->assertJsonPath('overpaid_rp', $price)->assertJsonPath('status', 'terbuka');
        $this->correct($unbilled, ['reason_type' => 'tidak_dikerjakan'])->assertCreated(); // the fixture's unbilled row
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertOk(); // approved credit note = handled; refund is cash, not a close gate

        $refund = $this->refund($inv, $pay, $nk['id'], $price)->assertStatus(202)->assertJsonPath('refunds.0.status', 'pending')
            ->assertJsonPath('refunds.0.payment_account_id', $this->account('QRIS klinik'))->assertJsonPath('refunds.0.method', 'qris')
            ->assertJsonPath('balance_rp', -$price)->json('refund_id'); // pending moves nothing
        $this->assertSame([$refund], array_column($this->as(self::OWNER)->getJson('/api/billing/reversals/pending')->json('refunds'), 'id'));
        $this->as(self::KASIR)->postJson("/api/refunds/$refund/approve")->assertForbidden();
        $this->as(self::DOC)->postJson("/api/refunds/$refund/approve")->assertForbidden();

        $done = $this->as(self::OWNER)->postJson("/api/refunds/$refund/approve")->assertOk()->json();
        $this->assertSame([0, 0, $price, $price, 'approved'], [$done['balance_rp'], $done['overpaid_rp'], $done['payments_rp'],
            $done['refunds_rp'], $done['refunds'][0]['status']]);
        $this->assertSame($price, $done['payments'][0]['refunded_rp']);
        $this->assertSame($before, $this->paymentRow($pay)); // same id, amount, account, time
        $this->assertSame(1, $this->in($this->tenantA(), fn () => InvoicePayment::where('invoice_id', $inv)->count()));
        $this->as(self::OWNER)->postJson("/api/refunds/$refund/approve")->assertConflict()->assertJsonPath('error', 'not_pending');
        $this->assertSame([], $this->as(self::OWNER)->getJson('/api/billing/reversals/pending')->json('refunds'));
        foreach (['refund.diajukan', 'refund.disetujui'] as $a) {
            $this->assertTrue($this->audited($a, $this->tenantA()), $a);
        }
    }

    public function test_refund_goes_only_to_the_original_account_and_never_above_note_payment_or_overpayment(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $big = $this->pay($inv, $line['price_rp'] - 10000);
        $small = $this->pay($inv, 10000, 'EDC BCA klinik');
        $nk = $this->credit($inv, $line['id'], 50000)->assertCreated()->assertJsonPath('overpaid_rp', 50000)->json('credit_note_id');

        $this->refund($inv, $big, $nk, 1000, ['payment_account_id' => $this->account('EDC BCA klinik')])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_account_id');
        $this->refund($inv, $big, $nk, 1000, ['account_number' => '1234567890'])->assertUnprocessable()->assertJsonPath('error', 'unknown_fields');
        $this->refund($inv, $big, $nk, 50001)->assertUnprocessable()->assertJsonPath('error', 'refund_exceeds'); // > credit note / overpayment
        $this->refund($inv, $small, $nk, 10001)->assertUnprocessable()->assertJsonPath('error', 'refund_exceeds'); // > that payment
        $this->refund($inv, $big, $nk, 1000, ['reason' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->refund($inv, $small, $nk, 10000, ['payment_account_id' => $this->account('EDC BCA klinik')])->assertStatus(202);
        $this->refund($inv, $big, $nk, 40001)->assertUnprocessable(); // the pending one reserves its amount
        $this->refund($inv, $big, $nk, 40000)->assertStatus(202);
        $this->refund($inv, $big, $nk, 1, as: 'asisten@senyum.test')->assertForbidden();

        // a payment of another invoice cannot be refunded here
        [, , $other] = $this->billed();
        $this->refund($other, $big, $nk, 1)->assertUnprocessable()->assertJsonValidationErrors('payment_id');
    }

    public function test_owner_who_did_the_work_needs_another_owner_and_a_rejected_refund_frees_the_amount(): void
    {
        $this->in($this->tenantA(), fn () => Membership::create(['user_id' => $this->user(self::DOC)->id, 'role' => 'owner', 'branch_id' => null]));
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $pay = $this->pay($inv, $line['price_rp']);
        $nk = $this->credit($inv, $line['id'], 30000)->json('credit_note_id');
        $r = $this->refund($inv, $pay, $nk, 30000)->json('refund_id');
        $this->as(self::DOC)->postJson("/api/refunds/$r/approve")->assertForbidden()->assertJsonPath('error', 'conflict_of_interest');
        $this->assertTrue($this->audited('refund.konflik', $this->tenantA()));
        $this->as(self::OWNER)->postJson("/api/refunds/$r/reject", ['reason' => 'Konfirmasi pasien dulu'])->assertOk()
            ->assertJsonPath('refunds.0.status', 'rejected')->assertJsonPath('balance_rp', -30000);
        $this->assertTrue($this->audited('refund.ditolak', $this->tenantA()));
        $this->refund($inv, $pay, $nk, 30000)->assertStatus(202);
    }

    public function test_tenant_isolation(): void
    {
        [, , $invB] = $this->billed('dokter@ceria.test');
        $lineB = $this->invoice($invB, 'kasir@ceria.test')['lines'][0];
        $accB = $this->as('kasir@ceria.test')->getJson('/api/payment-accounts')->json('0.id');
        $payB = $this->as('kasir@ceria.test')->postJson("/api/invoices/$invB/payments", ['payment_account_id' => $accB, 'amount_rp' => $lineB['price_rp']])
            ->assertCreated()->json('payments.0.id');
        $nkB = $this->credit($invB, $lineB['id'], 1000, 'kasir@ceria.test')->json('credit_note_id');
        $rB = $this->refund($invB, $payB, $nkB, 1000, as: 'kasir@ceria.test')->assertStatus(202)->json('refund_id');

        $this->refund($invB, $payB, $nkB, 1000)->assertNotFound();
        $this->as(self::OWNER)->postJson("/api/refunds/$rB/approve")->assertNotFound();
        $this->assertSame([], $this->as(self::OWNER)->getJson('/api/billing/reversals/pending')->json('refunds'));
        $this->as('dokter@ceria.test')->postJson("/api/refunds/$rB/approve")->assertOk()->assertJsonPath('refunds.0.self_approved_sole_owner', true);
    }

    public function test_refund_rows_are_immutable_in_the_database(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $pay = $this->pay($inv, $line['price_rp']);
        $nk = $this->credit($inv, $line['id'], 1000)->json('credit_note_id');
        $this->refund($inv, $pay, $nk, 1000)->assertStatus(202);
        $t = $this->tenantA()->id;
        foreach (['UPDATE invoice_refund SET amount_rp = 1 WHERE tenant_id = ?', 'DELETE FROM invoice_refund WHERE tenant_id = ?',
            'UPDATE invoice_payment SET amount_rp = 1 WHERE tenant_id = ?'] as $sql) {
            try {
                DB::statement($sql, [$t]);
                $this->fail("allowed: $sql");
            } catch (QueryException $e) {
                $this->assertMatchesRegularExpression('/hanya boleh ditambah|command denied/', $e->getMessage());
            }
        }
    }
}
