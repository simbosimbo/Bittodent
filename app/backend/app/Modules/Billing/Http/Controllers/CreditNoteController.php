<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Domain\InvoiceStatus;
use App\Modules\Billing\Listeners\InvoiceFromProcedure;
use App\Modules\Billing\Models\BillingDecision;
use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\InvoiceVoid;
use App\Modules\Billing\Models\LineCorrection;
use App\Modules\Billing\Services\Ledger;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Unit B koreksi (DEVIATIONS #54): financial corrections as their own documents. Never a Rp0 line, never a 100% discount.
// Credit note (Nota Kredit) per invoice line: partial = billing.adjust, applies at once; full (covers the rest of the line) waits for an
// owner (billing.approve_reversal). Void = only an invoice without payments. Owner decisions reuse the unit 4 conflict-of-interest rule.
class CreditNoteController extends Controller
{
    /** POST /api/invoices/{id}/credit-notes {invoice_line_id, amount_rp, reason_type, reason, procedure_correction_id?}: perm billing.adjust. */
    public function store(Request $request, string $id)
    {
        $d = $request->validate([
            'invoice_line_id' => ['required', 'uuid'],
            'amount_rp' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'reason_type' => ['required', 'in:'.implode(',', CreditNote::REASON_TYPES)],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'procedure_correction_id' => ['nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = InvoiceController::voided($inv) ?? self::lineRefs($inv, $d['invoice_line_id'], $d['procedure_correction_id'] ?? null)) {
                return $e;
            }
            $line = InvoiceLine::findOrFail($d['invoice_line_id']);
            if ($d['amount_rp'] > Ledger::creditable($line)) {
                return response()->json(['message' => 'Jumlah melebihi nilai baris yang masih bisa dikredit.',
                    'errors' => ['amount_rp' => ['Maksimal Rp'.Ledger::creditable($line).'.']]], 422);
            }
            $full = $d['amount_rp'] === Ledger::creditable($line);
            if (! $full && $d['amount_rp'] > Ledger::totals($inv)['balance_rp']) {
                return self::refundRequired();
            }
            $note = self::issue($inv, $line, $d['amount_rp'], $d['reason_type'], $d['reason'], $d['procedure_correction_id'] ?? null);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv) + ['credit_note_id' => $note->id], $note->requires_approval ? 202 : 201);
        });
    }

    /** Numbered credit note; full (rest of the line) = pending owner approval. Caller holds the invoice lock and validated the amount. */
    public static function issue(Invoice $inv, InvoiceLine $line, int $amount, string $type, string $reason, ?string $correctionId): CreditNote
    {
        $full = $amount === Ledger::creditable($line);
        $note = CreditNote::create(['number' => Ledger::nextCreditNoteNumber(), 'invoice_id' => $inv->id, 'invoice_line_id' => $line->id,
            'procedure_correction_id' => $correctionId, 'amount_rp' => $amount, 'is_full' => $full, 'reason_type' => $type, 'reason' => $reason,
            'requires_approval' => $full, 'created_by' => Ctx::current()->userId]);
        Audit::log($full ? 'nota_kredit.menunggu' : 'nota_kredit.dibuat', 'invoice', $inv->id, ['credit_note_id' => $note->id,
            'number' => $note->number, 'invoice_line_id' => $line->id, 'procedure_correction_id' => $correctionId, 'amount_rp' => $amount,
            'reason_type' => $type, 'is_full' => $full]);

        return $note;
    }

    /** POST /api/credit-notes/{id}/approve|reject {reason?}: owner (billing.approve_reversal), once per pending credit note. */
    public function decide(Request $request, string $id, string $decision)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return DB::transaction(function () use ($d, $id, $decision) {
            $note = CreditNote::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($note->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (! $note->requires_approval || BillingDecision::where('credit_note_id', $note->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Nota kredit ini tidak sedang menunggu persetujuan.'], 409);
            }
            $self = false;
            if ($decision === 'approved') {
                if ($e = InvoiceController::voided($inv)) {
                    return $e;
                }
                if ($note->amount_rp > Ledger::totals($inv)['balance_rp']) {
                    return self::refundRequired();
                }
                $self = Ledger::ownerCheck($inv, [InvoiceLine::findOrFail($note->invoice_line_id)->doctor_id], 'nota_kredit.konflik',
                    ['credit_note_id' => $note->id], 'Anda menangani tindakan ini. Nota kredit penuh harus disetujui pemilik lain.');
                if ($self instanceof JsonResponse) {
                    return $self;
                }
            }
            self::decision(['credit_note_id' => $note->id], $decision, $d['reason'] ?? null, $self);
            Audit::log('nota_kredit.'.($decision === 'approved' ? 'disetujui' : 'ditolak'), 'invoice', $inv->id,
                ['credit_note_id' => $note->id, 'number' => $note->number, 'self_approved_sole_owner' => $self]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv));
        });
    }

    /**
     * POST /api/invoices/{id}/void {reason}: perm billing.adjust. Only when the invoice has no payment at all (else 422: credit note +
     * refund). No lines = void at once; billed (selesai) lines = pending owner approval (billing.approve_reversal).
     */
    public function void(Request $request, string $id)
    {
        $d = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']]);

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = InvoiceController::voided($inv) ?? self::paid($inv)) {
                return $e;
            }
            if (Ledger::pending(InvoiceVoid::where('invoice_id', $inv->id), 'invoice_void_id')->exists()) {
                return response()->json(['error' => 'void_pending', 'message' => 'Pembatalan tagihan ini sedang menunggu pemilik.'], 409);
            }
            $billed = InvoiceLine::where('invoice_id', $inv->id)->exists(); // every line comes from a `selesai` procedure
            $v = InvoiceVoid::create(['invoice_id' => $inv->id, 'reason' => $d['reason'], 'requires_approval' => $billed, 'created_by' => Ctx::current()->userId]);
            Audit::log($billed ? 'void.menunggu' : 'void.dibuat', 'invoice', $inv->id, ['invoice_void_id' => $v->id]);
            if (! $billed) {
                InvoiceStatus::move($inv, 'void');
            }

            return response()->json(Ledger::out($inv) + ['invoice_void_id' => $v->id], $billed ? 202 : 201);
        });
    }

    /** POST /api/invoice-voids/{id}/approve|reject {reason?}: owner (billing.approve_reversal). Approve re-checks: still no payment. */
    public function decideVoid(Request $request, string $id, string $decision)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return DB::transaction(function () use ($d, $id, $decision) {
            $v = InvoiceVoid::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($v->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (! $v->requires_approval || BillingDecision::where('invoice_void_id', $v->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Pembatalan ini tidak sedang menunggu persetujuan.'], 409);
            }
            $self = false;
            if ($decision === 'approved') {
                if ($e = InvoiceController::voided($inv) ?? self::paid($inv)) {
                    return $e;
                }
                $self = Ledger::ownerCheck($inv, InvoiceLine::where('invoice_id', $inv->id)->pluck('doctor_id')->all(), 'void.konflik',
                    ['invoice_void_id' => $v->id], 'Anda menangani tindakan di tagihan ini. Pembatalan harus disetujui pemilik lain.');
                if ($self instanceof JsonResponse) {
                    return $self;
                }
            }
            self::decision(['invoice_void_id' => $v->id], $decision, $d['reason'] ?? null, $self);
            Audit::log('void.'.($decision === 'approved' ? 'disetujui' : 'ditolak'), 'invoice', $inv->id,
                ['invoice_void_id' => $v->id, 'self_approved_sole_owner' => $self]);
            if ($decision === 'approved') {
                InvoiceStatus::move($inv, 'void');
            }

            return response()->json(Ledger::out($inv));
        });
    }

    /** GET /api/billing/reversals/pending: owner (billing.approve_reversal). Pending full credit notes and voids in the owner's branches. */
    public function pending()
    {
        $ctx = Ctx::current();
        $notes = Ledger::pending(CreditNote::query(), 'credit_note_id')->orderBy('created_at')->get();
        $voids = Ledger::pending(InvoiceVoid::query(), 'invoice_void_id')->orderBy('created_at')->get();
        $inv = Invoice::whereIn('id', $notes->pluck('invoice_id')->merge($voids->pluck('invoice_id'))->unique())->get()->keyBy('id');
        $lines = InvoiceLine::whereIn('id', $notes->pluck('invoice_line_id'))->get()->keyBy('id');
        $mine = fn ($r) => $ctx->coversBranch($inv[$r->invoice_id]->branch_id);
        $base = fn ($r) => ['invoice_id' => $r->invoice_id, 'visit_id' => $inv[$r->invoice_id]->visit_id, 'created_by' => $r->created_by,
            'created_at' => $r->created_at, 'reason' => $r->reason];

        return response()->json([
            'credit_notes' => $notes->filter($mine)->map(fn ($n) => $base($n) + $n->only(['id', 'number', 'amount_rp', 'reason_type',
                'procedure_correction_id', 'invoice_line_id']) + ['line' => $lines[$n->invoice_line_id]->only(['procedure_code', 'procedure_name',
                    'tooth', 'price_rp'])])->values(),
            'voids' => $voids->filter($mine)->map(fn ($v) => $base($v) + ['id' => $v->id])->values(),
        ]);
    }

    /**
     * POST /api/invoices/{id}/lines/from-correction/{correctionId}: perm billing.adjust. "Tagih kode yang benar": bills the corrected
     * procedure of a salah_* correction at the tariff snapshot of NOW (same listener as normal billing). The old line is never touched;
     * pair it with a credit note on the old line. Idempotent: a second call returns the invoice unchanged.
     */
    public function lineFromCorrection(string $id, string $correctionId, InvoiceFromProcedure $billing)
    {
        return DB::transaction(function () use ($id, $correctionId, $billing) {
            $inv = Invoice::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = InvoiceController::voided($inv)) {
                return $e;
            }
            $r = LineCorrection::where('invoice_id', $inv->id)->where('procedure_correction_id', $correctionId)->firstOrFail();
            if (InvoiceLine::where('procedure_id', $r->new_procedure_id)->exists()) {
                return response()->json(Ledger::out($inv));
            }
            if ($r->billable === null) {
                return response()->json(['error' => 'not_billable', 'message' => 'Tindakan hasil koreksi tidak berstatus selesai berkode; tidak ada yang ditagih.'], 422);
            }
            $b = $r->billable;
            $billing->handle(new ProcedureRecorded(Ctx::current()->tenant(), $inv->visit_id, $b['procedure_code'], $b['variant'], $b['tooth'],
                $r->new_procedure_id, $b['dentist_id'], $b['dentist_category'], $b['dentist_field'], $b['surfaces']));
            $line = InvoiceLine::where('procedure_id', $r->new_procedure_id)->first();
            if ($line === null) {
                return response()->json(['error' => 'tariff_missing', 'message' => 'Tarif kode yang benar belum ada. Lengkapi master tarif dulu.'], 422);
            }
            Audit::log('koreksi_tagihan.ditagih', 'invoice', $inv->id, ['line_correction_id' => $r->id, 'procedure_correction_id' => $correctionId,
                'invoice_line_id' => $line->id, 'price_rp' => $line->price_rp]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv), 201);
        });
    }

    /** POST /api/line-corrections/{id}/review {reason}: perm billing.adjust. Same price after the correction: reviewed, no money document. */
    public function review(Request $request, string $id)
    {
        $d = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);

        return DB::transaction(function () use ($d, $id) {
            $r = LineCorrection::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($r->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (BillingDecision::where('line_correction_id', $r->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Sudah ditinjau.'], 409);
            }
            self::decision(['line_correction_id' => $r->id], 'reviewed', $d['reason'], false);
            Audit::log('koreksi_tagihan.ditinjau', 'invoice', $inv->id, ['line_correction_id' => $r->id, 'procedure_correction_id' => $r->procedure_correction_id]);

            return response()->json(Ledger::out($inv));
        });
    }

    /**
     * POST /api/invoice-lines/{id}/approve-zero-tariff {reason?}: owner (billing.approve_zero). A Rp0 tariff line is a tariff anomaly
     * (not a correction): the owner confirms it is intended. To bill it after all: fix the tariff, then a kind=correction (negative).
     */
    public function approveZeroTariff(Request $request, string $id)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return DB::transaction(function () use ($d, $id) {
            $line = InvoiceLine::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($line->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (! $line->tariff_zero || BillingDecision::where('invoice_line_id', $line->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Baris ini tidak sedang menunggu persetujuan tarif Rp0.'], 409);
            }
            $self = Ledger::ownerCheck($inv, [$line->doctor_id], 'tarif_nol.konflik', ['invoice_line_id' => $line->id],
                'Anda menangani tindakan ini. Tarif Rp0 harus disetujui pemilik lain.');
            if ($self instanceof JsonResponse) {
                return $self;
            }
            self::decision(['invoice_line_id' => $line->id], 'approved', $d['reason'] ?? null, $self);
            Audit::log('tarif_nol.disetujui', 'invoice', $inv->id, ['invoice_line_id' => $line->id, 'self_approved_sole_owner' => $self]);

            return response()->json(Ledger::out($inv));
        });
    }

    /** 422 unless the line is on this invoice and, when a correction id is given, that correction flagged this line. */
    public static function lineRefs(Invoice $inv, string $lineId, ?string $correctionId): ?JsonResponse
    {
        if (! InvoiceLine::where('invoice_id', $inv->id)->whereKey($lineId)->exists()) {
            return response()->json(['message' => 'Baris tagihan tidak ada di tagihan ini.', 'errors' => ['invoice_line_id' => ['Tidak dikenal.']]], 422);
        }
        if ($correctionId !== null && ! LineCorrection::where('invoice_line_id', $lineId)->where('procedure_correction_id', $correctionId)->exists()) {
            return response()->json(['message' => 'Koreksi klinis ini tidak terkait baris tersebut.', 'errors' => ['procedure_correction_id' => ['Tidak terkait.']]], 422);
        }

        return null;
    }

    private static function decision(array $subject, string $decision, ?string $reason, bool $self): void
    {
        BillingDecision::create([...$subject, 'decision' => $decision, 'reason' => $reason, 'decided_by' => Ctx::current()->userId,
            'self_approved_sole_owner' => $self]);
    }

    private static function paid(Invoice $inv): ?JsonResponse
    {
        return InvoicePayment::where('invoice_id', $inv->id)->exists()
            ? response()->json(['error' => 'has_payments', 'message' => 'Tagihan sudah ada pembayaran: tidak bisa dibatalkan. Pakai nota kredit (dan refund bila perlu).'], 422)
            : null;
    }

    private static function refundRequired(): JsonResponse
    {
        return response()->json(['error' => 'refund_required',
            'message' => 'Nota kredit melebihi sisa tagihan (sudah dibayar). Pengembalian dana (refund) belum tersedia.'], 422);
    }
}
