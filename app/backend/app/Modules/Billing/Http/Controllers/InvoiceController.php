<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
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

    /**
     * POST /api/invoices/{id}/adjustments {kind, amount_rp, reason}: front desk / owner / kasir (route perm billing.adjust).
     * Unit 4: one that would bring the balance to exactly Rp0 (100% discount / full write-off) is stored as pending (202) and counts
     * only after an owner approves it (decide()).
     */
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
            $zero = self::totals($inv)['balance_rp'] - $d['amount_rp'] === 0;
            $adj = InvoiceAdjustment::create([...$d, 'invoice_id' => $inv->id, 'created_by' => Ctx::current()->userId, 'requires_approval' => $zero]);
            Audit::log($zero ? 'penyesuaian_menunggu' : 'penyesuaian', 'invoice', $inv->id, ['adjustment_id' => $adj->id, 'kind' => $adj->kind, 'amount_rp' => $adj->amount_rp]);

            return response()->json(self::out($inv), $zero ? 202 : 201);
        });
    }

    /**
     * POST /api/invoice-adjustments/{id}/approve|reject {reason?}: owner only (perm billing.approve_zero), once per pending adjustment.
     * Conflict of interest: an owner may not approve a Rp0 on work they performed (line doctor or visit dentist) when the tenant has
     * another active owner; a sole owner may, flagged self_approved_sole_owner for the owner report.
     */
    public function decide(Request $request, string $id, string $decision, VisitDirectory $visits, TenancyDirectory $tenancy)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $decision, $visits, $tenancy, $me) {
            $adj = InvoiceAdjustment::findOrFail($id);
            $inv = Invoice::lockForUpdate()->findOrFail($adj->invoice_id);
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if (! $adj->requires_approval || InvoiceAdjustmentDecision::where('adjustment_id', $adj->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Penyesuaian ini tidak sedang menunggu persetujuan.'], 409);
            }
            $self = false;
            if ($decision === 'approved') {
                if (self::totals($inv)['balance_rp'] - $adj->amount_rp < 0) {
                    return response()->json(['error' => 'negative_balance', 'message' => 'Penyesuaian membuat saldo di bawah nol.'], 422);
                }
                $performers = [...InvoiceLine::where('invoice_id', $inv->id)->pluck('doctor_id')->all(), $visits->findOrFail($inv->visit_id)['dentist_id']];
                $self = in_array($me, $performers, true);
                if ($self && array_diff($tenancy->activeUserIdsWithRole('owner'), [$me]) !== []) {
                    Audit::log('penyesuaian_konflik', 'invoice', $inv->id, ['adjustment_id' => $adj->id]);

                    return response()->json(['error' => 'conflict_of_interest',
                        'message' => 'Anda menangani tindakan ini. Persetujuan Rp0 harus oleh pemilik lain.'], 403);
                }
            }
            InvoiceAdjustmentDecision::create(['adjustment_id' => $adj->id, 'decision' => $decision, 'reason' => $d['reason'] ?? null,
                'decided_by' => $me, 'self_approved_sole_owner' => $self]);
            Audit::log($decision === 'approved' ? 'penyesuaian_disetujui' : 'penyesuaian_ditolak', 'invoice', $inv->id,
                ['adjustment_id' => $adj->id, 'self_approved_sole_owner' => $self]);

            return response()->json(self::out($inv));
        });
    }

    /** balance = sum(lines) - sum(applied adjustments), computed every time (never stored). Pending/rejected Rp0 requests do not count. */
    private static function totals(Invoice $inv): array
    {
        $lines = (int) InvoiceLine::where('invoice_id', $inv->id)->sum('price_rp');
        $adj = (int) InvoiceAdjustment::where('invoice_id', $inv->id)->where(fn ($q) => $q->where('requires_approval', false)
            ->orWhereIn('id', InvoiceAdjustmentDecision::where('decision', 'approved')->select('adjustment_id')))->sum('amount_rp');

        return ['lines_rp' => $lines, 'adjustments_rp' => $adj, 'balance_rp' => $lines - $adj];
    }

    private static function out(Invoice $inv): array
    {
        $decisions = InvoiceAdjustmentDecision::whereIn('adjustment_id', InvoiceAdjustment::where('invoice_id', $inv->id)->select('id'))->get()->keyBy('adjustment_id');

        return [...$inv->only(['id', 'visit_id', 'patient_id', 'payer_patient_id', 'branch_id', 'status', 'created_at']), ...self::totals($inv),
            'lines' => InvoiceLine::where('invoice_id', $inv->id)->orderBy('created_at')->get()
                ->map->only(['id', 'procedure_id', 'procedure_code', 'procedure_name', 'variant', 'tooth', 'surface', 'price_rp', 'created_at']),
            'adjustments' => InvoiceAdjustment::where('invoice_id', $inv->id)->orderBy('created_at')->get()
                ->map(fn ($a) => [...$a->only(['id', 'kind', 'amount_rp', 'reason', 'created_by', 'created_at']),
                    // applied | pending (waits for owner) | approved | rejected
                    'status' => ! $a->requires_approval ? 'applied' : ($decisions[$a->id]->decision ?? 'pending'),
                    'self_approved_sole_owner' => (bool) ($decisions[$a->id]->self_approved_sole_owner ?? false)])];
    }
}
