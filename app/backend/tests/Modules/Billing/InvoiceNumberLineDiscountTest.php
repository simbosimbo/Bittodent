<?php

namespace Tests\Modules\Billing;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// KlinikMe parity: a No. Faktur per invoice, and a discount (or write-off) on one tindakan line instead of the whole bill.
class InvoiceNumberLineDiscountTest extends TestCase
{
    use BilledVisit;

    public function test_invoices_are_numbered_in_order_and_a_number_never_changes(): void
    {
        [, , $a] = $this->billed();
        [, , $b] = $this->billed();
        $na = $this->invoice($a)['number'];
        $nb = $this->invoice($b)['number'];
        $this->assertMatchesRegularExpression('/^INV-\d{4}-\d{6}$/', $na);
        $this->assertSame((int) substr($na, -6) + 1, (int) substr($nb, -6));

        $this->expectException(QueryException::class); // MySQL trigger: once given, fixed
        $this->in($this->tenantA(), fn () => DB::table('invoice')->where('id', $a)->update(['number' => 'INV-1999-000001']));
    }

    public function test_a_discount_on_one_line_is_shown_on_that_line_and_capped_at_what_is_left_of_it(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $cut = intdiv($line['price_rp'], 4);
        $adjust = fn (array $b) => $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", $b + ['kind' => 'discount', 'reason' => 'Diskon pasien lama']);

        $out = $adjust(['amount_rp' => $cut, 'invoice_line_id' => $line['id']])->assertCreated()->json();
        $this->assertSame([$cut, $line['price_rp']], [$out['lines'][0]['discount_rp'], $out['lines'][0]['price_rp']]); // snapshot untouched
        $this->assertSame($line['price_rp'] - $cut, $out['balance_rp']);

        $adjust(['amount_rp' => $line['price_rp'] - $cut + 1, 'invoice_line_id' => $line['id']])->assertStatus(422)->assertJsonPath('error', 'over_line');
        // a discounted line can no longer be credited in full (no phantom overpayment)
        $this->credit($inv, $line['id'], $line['price_rp'])->assertStatus(422);
        $this->credit($inv, $line['id'], $line['price_rp'] - $cut)->assertSuccessful();

        [, , $otherInv] = $this->billed(); // a line of another invoice is refused
        $adjust(['amount_rp' => 1000, 'invoice_line_id' => $this->invoice($otherInv)['lines'][0]['id']])->assertStatus(422)
            ->assertJsonPath('errors.invoice_line_id.0', 'Tidak dikenal.');
    }
}
