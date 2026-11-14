<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceLine;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Invoice = generated lines (price snapshots, append-only) minus adjustments (append-only). Integer rupiah. No endpoint takes a price.
class InvoiceController extends Controller
{
    /** GET /api/visits/{id}/invoice */
    public function forVisit(string $id)
    {
        return $this->show(Invoice::where('visit_id', $id)->firstOrFail()->id);
    }

    /** GET /api/invoices/{id} */
    public function show(string $id)
    {
        $inv = Invoice::findOrFail($id);
        if (! Ctx::current()->coversBranch($inv->branch_id)) {
            return Audit::denied('branch:'.$inv->branch_id);
        }

        return response()->json(self::out($inv));
    }

    /** POST /api/invoices/{id}/adjustments {kind, amount_rp, reason}: front desk / owner (route perm billing.adjust). */
    public function adjust(Request $request, string $id)
    {
        $d = $request->validate([
            'kind' => ['required', 'in:discount,write_off,correction'],
            'amount_rp' => ['required', 'integer', 'not_in:0', 'min:-1000000000', 'max:1000000000'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);
        if ($d['kind'] !== 'correction' && $d['amount_rp'] < 0) {
            return response()->json(['message' => 'Diskon/penghapusan harus positif.', 'errors' => ['amount_rp' => ['Harus positif.']]], 422);
        }

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id); // serializes adjustments: balance check below is race-free
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (self::totals($inv)['balance_rp'] - $d['amount_rp'] < 0) {
                return response()->json(['error' => 'negative_balance', 'message' => 'Penyesuaian membuat saldo di bawah nol.'], 422);
            }
            $adj = InvoiceAdjustment::create([...$d, 'invoice_id' => $inv->id, 'created_by' => Ctx::current()->userId]);
            Audit::log('penyesuaian', 'invoice', $inv->id, ['adjustment_id' => $adj->id, 'kind' => $adj->kind, 'amount_rp' => $adj->amount_rp]);

            return response()->json(self::out($inv), 201);
        });
    }

    /** balance = sum(lines) - sum(adjustments), computed every time (never stored). */
    private static function totals(Invoice $inv): array
    {
        $lines = (int) InvoiceLine::where('invoice_id', $inv->id)->sum('price_rp');
        $adj = (int) InvoiceAdjustment::where('invoice_id', $inv->id)->sum('amount_rp');

        return ['lines_rp' => $lines, 'adjustments_rp' => $adj, 'balance_rp' => $lines - $adj];
    }

    private static function out(Invoice $inv): array
    {
        return [...$inv->only(['id', 'visit_id', 'patient_id', 'payer_patient_id', 'branch_id', 'status', 'created_at']), ...self::totals($inv),
            'lines' => InvoiceLine::where('invoice_id', $inv->id)->orderBy('created_at')->get()
                ->map->only(['id', 'finding_id', 'procedure_code', 'variant', 'tooth', 'price_rp', 'created_at']),
            'adjustments' => InvoiceAdjustment::where('invoice_id', $inv->id)->orderBy('created_at')->get()
                ->map->only(['id', 'kind', 'amount_rp', 'reason', 'created_by', 'created_at'])];
    }
}
