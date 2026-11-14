<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice';

    protected $guarded = ['tenant_id'];

    /** balance = lines - adjustments - payments, computed every time (never stored). Integer rupiah. */
    public function totals(): array
    {
        $lines = (int) InvoiceLine::where('invoice_id', $this->id)->sum('price_rp');
        $adj = (int) InvoiceAdjustment::where('invoice_id', $this->id)->sum('amount_rp');
        $paid = (int) Payment::where('invoice_id', $this->id)->sum('amount_rp');

        return ['lines_rp' => $lines, 'adjustments_rp' => $adj, 'payments_rp' => $paid, 'balance_rp' => $lines - $adj - $paid];
    }
}
