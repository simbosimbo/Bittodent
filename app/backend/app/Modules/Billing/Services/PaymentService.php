<?php

namespace App\Modules\Billing\Services;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\Payment;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Records cash collected (not a price). Amount must fit the remaining balance; balance 0 => invoice `lunas`.
class PaymentService
{
    public function record(string $invoiceId, int $amountRp, string $method): Payment
    {
        if ($amountRp <= 0) {
            throw ValidationException::withMessages(['amount_rp' => ['Jumlah bayar harus lebih dari nol.']]);
        }
        if (! in_array($method, Payment::METHODS, true)) {
            throw ValidationException::withMessages(['method' => ['Metode bayar tidak dikenal.']]);
        }

        return DB::transaction(function () use ($invoiceId, $amountRp, $method) {
            $inv = Invoice::lockForUpdate()->findOrFail($invoiceId); // serializes payments + adjustments on this invoice
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                throw new HttpResponseException(Audit::denied('branch:'.$inv->branch_id));
            }
            $balance = $inv->totals()['balance_rp'];
            if ($amountRp > $balance) {
                throw ValidationException::withMessages(['amount_rp' => ['Jumlah bayar melebihi sisa tagihan.']]);
            }
            $p = Payment::create(['invoice_id' => $inv->id, 'branch_id' => $inv->branch_id, 'amount_rp' => $amountRp,
                'method' => $method, 'paid_at' => now(), 'created_by' => Ctx::current()->userId]);
            if ($balance === $amountRp) {
                $inv->update(['status' => 'lunas']);
            }
            Audit::log('bayar', 'invoice', $inv->id, ['payment_id' => $p->id, 'amount_rp' => $amountRp, 'method' => $method]);

            return $p;
        });
    }
}
