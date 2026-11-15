<?php

namespace App\Modules\Billing\Services;

use App\Modules\Billing\Domain\InvoiceStatus;
use App\Modules\Billing\Models\BillingDecision;
use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\CreditNoteSeq;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\InvoiceVoid;
use App\Modules\Billing\Models\LineCorrection;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Invoice arithmetic + shape, shared by the Billing controllers and listeners. Everything computed, nothing stored.
// balance = lines - applied adjustments - applied credit notes - payments; a void invoice owes Rp0.
final class Ledger
{
    public static function totals(Invoice $inv): array
    {
        $lines = (int) InvoiceLine::where('invoice_id', $inv->id)->sum('price_rp');
        $adj = (int) self::applied(InvoiceAdjustment::where('invoice_id', $inv->id), InvoiceAdjustmentDecision::class, 'adjustment_id')->sum('amount_rp');
        $credit = (int) self::applied(CreditNote::where('invoice_id', $inv->id), BillingDecision::class, 'credit_note_id')->sum('amount_rp');
        $paid = (int) InvoicePayment::where('invoice_id', $inv->id)->sum('amount_rp');

        return ['lines_rp' => $lines, 'adjustments_rp' => $adj, 'credit_notes_rp' => $credit, 'payments_rp' => $paid,
            'balance_rp' => $inv->status === 'void' ? 0 : $lines - $adj - $credit - $paid];
    }

    /** Rows that count: no approval needed, or approved by an owner. */
    public static function applied($query, string $decisionModel, string $fk)
    {
        return $query->where(fn ($q) => $q->where('requires_approval', false)
            ->orWhereIn('id', $decisionModel::where('decision', 'approved')->whereNotNull($fk)->select($fk)));
    }

    /** Requested and not decided yet. */
    public static function pending($query, string $fk)
    {
        return $query->where('requires_approval', true)->whereNotIn('id', BillingDecision::whereNotNull($fk)->select($fk));
    }

    /** What may still be credited on a line: price minus credit notes that are not rejected (pending ones reserve their amount). */
    public static function creditable(InvoiceLine $line): int
    {
        $rejected = BillingDecision::where('decision', 'rejected')->whereNotNull('credit_note_id')->select('credit_note_id');

        return $line->price_rp - (int) CreditNote::where('invoice_line_id', $line->id)->whereNotIn('id', $rejected)->sum('amount_rp');
    }

    public static function syncStatus(Invoice $inv): void
    {
        if ($inv->status === 'void') {
            return;
        }
        $t = self::totals($inv);
        // lunas = something was really owed and it is settled; fully credited (nothing left to bill) stays terbuka, never "lunas Rp0"
        InvoiceStatus::move($inv, $t['balance_rp'] === 0 && $t['lines_rp'] - $t['credit_notes_rp'] > 0 ? 'lunas' : 'terbuka');
    }

    /** NK-YYYY-000001, sequential per tenant and year. Caller is inside a transaction; the counter row lock serializes numbering. */
    public static function nextCreditNoteNumber(): string
    {
        $year = (int) now()->format('Y');
        $seq = CreditNoteSeq::createOrFirst(['year' => $year], ['last_number' => 0]);
        $seq = CreditNoteSeq::lockForUpdate()->findOrFail($seq->id);
        $seq->update(['last_number' => $seq->last_number + 1]);

        return sprintf('NK-%d-%06d', $year, $seq->last_number);
    }

    /**
     * Unit 4 conflict-of-interest rule, reused for reversals: an owner who performed the work (one of $doctorIds or the visit
     * dentist) may approve only when no other active owner exists, flagged self_approved_sole_owner. Returns the 403 or the flag.
     */
    public static function ownerCheck(Invoice $inv, array $doctorIds, string $auditAction, array $detail, string $message): JsonResponse|bool
    {
        $me = Ctx::current()->userId;
        $self = in_array($me, [...$doctorIds, app(VisitDirectory::class)->findOrFail($inv->visit_id)['dentist_id']], true);
        if ($self && array_diff(app(TenancyDirectory::class)->activeUserIdsWithRole('owner'), [$me]) !== []) {
            Audit::log($auditAction, 'invoice', $inv->id, $detail);

            return response()->json(['error' => 'conflict_of_interest', 'message' => $message], 403);
        }

        return $self;
    }

    public static function out(Invoice $inv): array
    {
        $accounts = PaymentAccount::whereIn('id', InvoicePayment::where('invoice_id', $inv->id)->select('payment_account_id'))->get()->keyBy('id');
        $decisions = InvoiceAdjustmentDecision::whereIn('adjustment_id', InvoiceAdjustment::where('invoice_id', $inv->id)->select('id'))->get()->keyBy('adjustment_id');
        $notes = CreditNote::where('invoice_id', $inv->id)->orderBy('number')->get();
        $voids = InvoiceVoid::where('invoice_id', $inv->id)->orderBy('created_at')->get();
        $lines = InvoiceLine::where('invoice_id', $inv->id)->orderBy('created_at')->get();
        $reviews = LineCorrection::where('invoice_id', $inv->id)->orderBy('created_at')->get();
        $bd = BillingDecision::where(fn ($q) => $q->whereIn('credit_note_id', $notes->pluck('id'))->orWhereIn('invoice_void_id', $voids->pluck('id'))
            ->orWhereIn('invoice_line_id', $lines->pluck('id'))->orWhereIn('line_correction_id', $reviews->pluck('id')))->get();
        $status = fn ($row, string $fk) => ! $row->requires_approval ? 'applied' : ($bd->firstWhere($fk, $row->id)->decision ?? 'pending');
        $billedProcs = $lines->pluck('procedure_id')->all();
        $noteOut = fn ($n) => [...$n->only(['id', 'number', 'invoice_line_id', 'procedure_correction_id', 'amount_rp', 'is_full', 'reason_type',
            'reason', 'created_by', 'created_at']), 'status' => $status($n, 'credit_note_id'),
            'self_approved_sole_owner' => (bool) ($bd->firstWhere('credit_note_id', $n->id)?->self_approved_sole_owner)];

        return [...$inv->only(['id', 'visit_id', 'patient_id', 'payer_patient_id', 'branch_id', 'status', 'created_at']), ...self::totals($inv),
            'lines' => $lines->map(function ($l) use ($notes, $reviews, $bd, $status, $billedProcs) {
                $mine = $notes->where('invoice_line_id', $l->id);
                $counted = $mine->filter(fn ($n) => in_array($status($n, 'credit_note_id'), ['applied', 'approved'], true));

                return [...$l->only(['id', 'procedure_id', 'procedure_code', 'procedure_name', 'variant', 'tooth', 'surface', 'price_rp', 'created_at']),
                    // original snapshot never changes; corrected = an applied credit note points at it ("Dikoreksi - lihat NK-...")
                    'credited_rp' => (int) $counted->sum('amount_rp'),
                    'credit_note_numbers' => $mine->pluck('number')->values(),
                    'tariff_zero' => $l->tariff_zero ? ($bd->firstWhere('invoice_line_id', $l->id)->decision ?? 'pending') : null,
                    'correction_reviews' => $reviews->where('invoice_line_id', $l->id)->map(fn ($r) => ['id' => $r->id,
                        'procedure_correction_id' => $r->procedure_correction_id, 'reason_type' => $r->reason_type,
                        'new_procedure_id' => $r->new_procedure_id, 'billable_code' => $r->billable['procedure_code'] ?? null,
                        'status' => self::reviewed($r, $notes->reject(fn ($n) => $status($n, 'credit_note_id') === 'rejected'), $bd, $billedProcs)
                            ? 'selesai' : 'perlu_tinjau'])->values()];
            }),
            'credit_notes' => $notes->map($noteOut)->values(),
            'voids' => $voids->map(fn ($v) => [...$v->only(['id', 'reason', 'created_by', 'created_at']), 'status' => $status($v, 'invoice_void_id')])->values(),
            'adjustments' => InvoiceAdjustment::where('invoice_id', $inv->id)->orderBy('created_at')->get()
                ->map(fn ($a) => [...$a->only(['id', 'kind', 'amount_rp', 'reason', 'invoice_line_id', 'procedure_correction_id', 'created_by', 'created_at']),
                    // applied | pending (waits for owner) | approved | rejected
                    'status' => ! $a->requires_approval ? 'applied' : ($decisions[$a->id]->decision ?? 'pending'),
                    'self_approved_sole_owner' => (bool) ($decisions[$a->id]->self_approved_sole_owner ?? false)]),
            'payments' => InvoicePayment::where('invoice_id', $inv->id)->orderBy('created_at')->get()->map(fn ($p) => [
                ...$p->only(['id', 'payment_account_id', 'amount_rp', 'paid_at', 'created_by']),
                'account' => $accounts[$p->payment_account_id]?->only(['name', 'kind', 'bank_name', 'account_last4'])])];
    }

    /** A flagged line is handled by: a credit note for that correction, a line billed for the corrected procedure, or a cashier review. */
    private static function reviewed(LineCorrection $r, $notes, $bd, array $billedProcs): bool
    {
        return $notes->contains(fn ($n) => $n->invoice_line_id === $r->invoice_line_id && $n->procedure_correction_id === $r->procedure_correction_id)
            || in_array($r->new_procedure_id, $billedProcs, true)
            || $bd->contains('line_correction_id', $r->id);
    }
}
