<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\BillingDecision;
use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\InvoiceRefund;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Billing\Services\Ledger;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Unit C koreksi (DEVIATIONS #57): refund = its own row (invoice_refund) back to the SAME clinic account as the original payment,
// allocated to an applied credit note. The original payment is never changed. Always waits for an owner (billing.approve_reversal,
// unit 4 conflict-of-interest rule). Method = the account kind (no other method: same account, same channel).
class RefundController extends Controller
{
    /** POST /api/invoices/{id}/refunds {payment_id, credit_note_id, amount_rp, reason, payment_account_id?}: perm billing.adjust. */
    public function store(Request $request, string $id)
    {
        if ($bad = PaymentAccountController::unknownKeys($request, ['payment_id', 'credit_note_id', 'amount_rp', 'reason', 'payment_account_id'])) {
            return $bad; // no free-text destination (rekening bebas)
        }
        $d = $request->validate([
            'payment_id' => ['required', 'uuid'],
            'credit_note_id' => ['required', 'uuid'],
            'amount_rp' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'payment_account_id' => ['nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = InvoiceController::voided($inv)) {
                return $e;
            }
            $payment = InvoicePayment::where('invoice_id', $inv->id)->find($d['payment_id']);
            if ($payment === null) {
                return self::invalid('payment_id', 'Pembayaran asal tidak ada di tagihan ini.');
            }
            if (($d['payment_account_id'] ?? $payment->payment_account_id) !== $payment->payment_account_id) {
                return self::invalid('payment_account_id', 'Refund hanya ke akun klinik yang sama dengan pembayaran asal.');
            }
            $note = CreditNote::where('invoice_id', $inv->id)->find($d['credit_note_id']);
            if ($note === null || ! Ledger::applied(CreditNote::whereKey($note->id), BillingDecision::class, 'credit_note_id')->exists()) {
                return self::invalid('credit_note_id', 'Nota kredit tidak ada di tagihan ini atau belum berlaku (menunggu/ditolak).');
            }
            if ($d['amount_rp'] > ($max = Ledger::refundable($inv, $note, $payment))) {
                return response()->json(['error' => 'refund_exceeds', 'message' => "Refund maksimal Rp$max (sisa nota kredit, sisa pembayaran asal, dan kelebihan bayar).",
                    'errors' => ['amount_rp' => ["Maksimal Rp$max."]]], 422);
            }
            $r = InvoiceRefund::create(['invoice_id' => $inv->id, 'credit_note_id' => $note->id, 'payment_id' => $payment->id,
                'payment_account_id' => $payment->payment_account_id, 'method' => PaymentAccount::findOrFail($payment->payment_account_id)->kind,
                'amount_rp' => $d['amount_rp'], 'reason' => $d['reason'], 'created_by' => Ctx::current()->userId]);
            Audit::log('refund.diajukan', 'invoice', $inv->id, ['refund_id' => $r->id, 'credit_note_id' => $note->id, 'payment_id' => $payment->id,
                'payment_account_id' => $r->payment_account_id, 'amount_rp' => $r->amount_rp]);

            return response()->json(Ledger::out($inv) + ['refund_id' => $r->id], 202);
        });
    }

    /** POST /api/refunds/{id}/approve|reject {reason?}: owner (billing.approve_reversal), once per refund. Approve re-checks the limits. */
    public function decide(Request $request, string $id, string $decision)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return DB::transaction(function () use ($d, $id, $decision) {
            $r = InvoiceRefund::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($r->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (BillingDecision::where('refund_id', $r->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Refund ini tidak sedang menunggu persetujuan.'], 409);
            }
            $self = false;
            if ($decision === 'approved') {
                $note = CreditNote::findOrFail($r->credit_note_id);
                if ($r->amount_rp > Ledger::refundable($inv, $note, InvoicePayment::findOrFail($r->payment_id), $r->id)) {
                    return response()->json(['error' => 'refund_exceeds', 'message' => 'Refund melebihi kelebihan bayar saat ini. Tolak lalu ajukan ulang.'], 422);
                }
                $self = Ledger::ownerCheck($inv, [InvoiceLine::findOrFail($note->invoice_line_id)->doctor_id], 'refund.konflik',
                    ['refund_id' => $r->id], 'Anda menangani tindakan ini. Refund harus disetujui pemilik lain.');
                if ($self instanceof JsonResponse) {
                    return $self;
                }
            }
            CreditNoteController::decision(['refund_id' => $r->id], $decision, $d['reason'] ?? null, $self);
            Audit::log('refund.'.($decision === 'approved' ? 'disetujui' : 'ditolak'), 'invoice', $inv->id,
                ['refund_id' => $r->id, 'amount_rp' => $r->amount_rp, 'payment_account_id' => $r->payment_account_id, 'self_approved_sole_owner' => $self]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv));
        });
    }

    private static function invalid(string $field, string $msg): JsonResponse
    {
        return response()->json(['message' => $msg, 'errors' => [$field => [$msg]]], 422);
    }
}
