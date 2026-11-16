<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Billing\Services\Ledger;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Invoice = generated lines (price snapshots, append-only) minus adjustments minus payments (both append-only). Integer rupiah.
// No endpoint takes a price. invoice.status: terbuka | lunas | void (Domain\InvoiceStatus). Shape + arithmetic: Services\Ledger.
class InvoiceController extends Controller
{
    private const TIMEZONE = 'Asia/Jakarta';

    /** GET /api/visits/{id}/invoice */
    public function forVisit(string $id)
    {
        return $this->show(Invoice::where('visit_id', $id)->firstOrFail()->id);
    }

    /**
     * GET /api/billing/daily-revenue: payments collected today (Asia/Jakarta) in the ACTIVE branch only, even for
     * memberships that cover every branch (Beranda is per cabang aktif). Write-offs/discounts are not payments, so never counted.
     */
    public function dailyRevenue()
    {
        $ctx = Ctx::current();
        $day = CarbonImmutable::now(self::TIMEZONE)->startOfDay();
        // One query; plucking a day's payments of one branch is small (no raw SUM: ArchitectureTest bans raw SQL fragments).
        // invoice_payment has no branch_id: the branch is the invoice's (gross money received; refunds are separate documents).
        $amounts = InvoicePayment::whereIn('invoice_id', Invoice::where('branch_id', $ctx->branchId)->select('id'))
            ->where('paid_at', '>=', $day->utc())->where('paid_at', '<', $day->addDay()->utc())->pluck('amount_rp');
        Audit::log('baca', 'daily_revenue', null, ['branch_id' => $ctx->branchId, 'date' => $day->toDateString()]);

        return response()->json(['date' => $day->toDateString(), 'branch_id' => $ctx->branchId,
            'amount_rp' => (int) $amounts->sum(), 'payment_count' => $amounts->count()]);
    }

    /**
     * GET /api/billing/invoices: the Kasir worklist (DEVIATIONS #69) for the ACTIVE branch: every open (terbuka) invoice, any day,
     * plus every invoice created today (Asia/Jakarta, so today's lunas/void ones stay visible). Newest first, at most 100.
     */
    public function index(PatientDirectory $patients)
    {
        $ctx = Ctx::current();
        $day = CarbonImmutable::now(self::TIMEZONE)->startOfDay();
        $rows = Invoice::where('branch_id', $ctx->branchId)
            ->where(fn ($q) => $q->where('status', 'terbuka')
                ->orWhere(fn ($q) => $q->where('created_at', '>=', $day->utc())->where('created_at', '<', $day->addDay()->utc())))
            ->orderByDesc('created_at')->limit(100)->get();
        $people = collect($patients->namesByIds($rows->pluck('patient_id')->unique()->values()->all()))->keyBy('id');
        // KL01 card line "Tumpatan 26 · Scaling": names + tooth of the billed lines, one query for the whole list.
        $items = InvoiceLine::whereIn('invoice_id', $rows->pluck('id'))->orderBy('created_at')->get(['invoice_id', 'procedure_name', 'procedure_code', 'tooth'])
            ->groupBy('invoice_id')->map(fn ($ls) => $ls->map(fn ($l) => trim(($l->procedure_name ?? $l->procedure_code).' '.$l->tooth))->values());
        Audit::log('baca', 'invoice_list', null, ['branch_id' => $ctx->branchId, 'date' => $day->toDateString(), 'count' => $rows->count()]);

        return response()->json(['date' => $day->toDateString(), 'branch_id' => $ctx->branchId,
            'invoices' => $rows->map(fn (Invoice $inv) => [...$inv->only(['id', 'visit_id', 'patient_id', 'status', 'created_at']),
                'patient_name' => $people[$inv->patient_id]['name'] ?? null, 'payer_type' => $people[$inv->patient_id]['payer_type'] ?? 'umum',
                'items' => $items[$inv->id] ?? [], ...Ledger::totals($inv)])->values()]);
    }

    /**
     * GET /api/billing/invoice-status?visit_ids=a,b,c: status (terbuka | lunas | void) of the invoices of up to 200 visits in ONE
     * request (Jadwal "Belum bayar"; replaces one /visits/{id}/invoice call per finished visit). Tenant-scoped by the model;
     * invoices of branches the membership does not cover are left out, like visits without an invoice.
     */
    public function statusForVisits(Request $request)
    {
        $ids = array_values(array_unique(array_filter(explode(',', (string) $request->query('visit_ids', '')),
            fn ($v) => preg_match('/^[0-9a-f-]{36}$/i', $v) === 1)));
        if (count($ids) > 200) {
            return response()->json(['message' => 'Maksimal 200 kunjungan per permintaan.', 'errors' => ['visit_ids' => ['Maksimal 200.']]], 422);
        }
        $ctx = Ctx::current();
        $rows = $ids ? Invoice::whereIn('visit_id', $ids)->get(['visit_id', 'status', 'branch_id'])
            ->filter(fn (Invoice $i) => $ctx->coversBranch($i->branch_id)) : collect();
        Audit::log('baca', 'invoice_status', null, ['count' => $rows->count()]);

        return response()->json(['statuses' => (object) $rows->pluck('status', 'visit_id')->all()]);
    }

    /** GET /api/invoices/{id} */
    public function show(string $id)
    {
        $inv = Invoice::findOrFail($id);
        if (! Ctx::current()->coversBranch($inv->branch_id)) {
            return Audit::denied('branch:'.$inv->branch_id);
        }

        // patient_name: for the Tagihan header and the printed kwitansi (#69)
        $name = app(PatientDirectory::class)->namesByIds([$inv->patient_id])[0]['name'] ?? null;

        return response()->json([...Ledger::out($inv), 'patient_name' => $name]);
    }

    /**
     * POST /api/invoices/{id}/adjustments {kind, amount_rp, reason, invoice_line_id?, procedure_correction_id?}: front desk / owner /
     * kasir (route perm billing.adjust). discount / write_off = genuine discounts (never to fix a procedure: that is a credit note).
     * kind=correction = tariff difference on ONE line (+ or -): invoice_line_id required (unit B; historic rows have none).
     * Unit 4: one that would bring the balance to exactly Rp0 (100% discount / full write-off) is stored as pending (202) and counts
     * only after an owner approves it (decide()).
     */
    public function adjust(Request $request, string $id)
    {
        $d = $request->validate([
            'kind' => ['required', 'in:discount,write_off,correction'],
            'amount_rp' => ['required', 'integer', 'not_in:0', 'min:-1000000000', 'max:1000000000'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'invoice_line_id' => ['required_if:kind,correction', 'nullable', 'uuid'], // discount / write_off: optional, on one line (KlinikMe per-baris)
            'procedure_correction_id' => ['prohibited_unless:kind,correction', 'nullable', 'uuid'],
        ]);
        if ($d['kind'] !== 'correction' && $d['amount_rp'] < 0) {
            return response()->json(['message' => 'Diskon/penghapusan harus positif.', 'errors' => ['amount_rp' => ['Harus positif.']]], 422);
        }

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id); // serializes adjustments: balance check below is race-free
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = self::voided($inv)) {
                return $e;
            }
            if (isset($d['invoice_line_id']) && ($e = CreditNoteController::lineRefs($inv, $d['invoice_line_id'], $d['procedure_correction_id'] ?? null))) {
                return $e;
            }
            if ($d['kind'] !== 'correction' && isset($d['invoice_line_id']) && $d['amount_rp'] > Ledger::creditable(InvoiceLine::findOrFail($d['invoice_line_id']))) {
                return response()->json(['error' => 'over_line', 'message' => 'Potongan melebihi sisa harga baris ini.'], 422);
            }
            if (Ledger::totals($inv)['balance_rp'] - $d['amount_rp'] < 0) {
                return response()->json(['error' => 'negative_balance', 'message' => 'Penyesuaian membuat saldo di bawah nol.'], 422);
            }
            $zero = Ledger::totals($inv)['balance_rp'] - $d['amount_rp'] === 0;
            $adj = InvoiceAdjustment::create([...$d, 'invoice_id' => $inv->id, 'created_by' => Ctx::current()->userId, 'requires_approval' => $zero]);
            Audit::log($zero ? 'penyesuaian_menunggu' : 'penyesuaian', 'invoice', $inv->id, ['adjustment_id' => $adj->id, 'kind' => $adj->kind,
                'amount_rp' => $adj->amount_rp, 'invoice_line_id' => $adj->invoice_line_id, 'procedure_correction_id' => $adj->procedure_correction_id]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv), $zero ? 202 : 201);
        });
    }

    /**
     * POST /api/invoice-adjustments/{id}/approve|reject {reason?}: owner only (perm billing.approve_zero), once per pending adjustment.
     * Conflict of interest: an owner may not approve a Rp0 on work they performed (line doctor or visit dentist) when the tenant has
     * another active owner; a sole owner may, flagged self_approved_sole_owner for the owner report.
     */
    public function decide(Request $request, string $id, string $decision)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $decision, $me) {
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
                if ($e = self::voided($inv)) {
                    return $e;
                }
                if (Ledger::totals($inv)['balance_rp'] - $adj->amount_rp < 0) {
                    return response()->json(['error' => 'negative_balance', 'message' => 'Penyesuaian membuat saldo di bawah nol.'], 422);
                }
                $self = Ledger::ownerCheck($inv, InvoiceLine::where('invoice_id', $inv->id)->pluck('doctor_id')->all(), 'penyesuaian_konflik',
                    ['adjustment_id' => $adj->id], 'Anda menangani tindakan ini. Persetujuan Rp0 harus oleh pemilik lain.');
                if ($self instanceof JsonResponse) {
                    return $self;
                }
            }
            InvoiceAdjustmentDecision::create(['adjustment_id' => $adj->id, 'decision' => $decision, 'reason' => $d['reason'] ?? null,
                'decided_by' => $me, 'self_approved_sole_owner' => $self]);
            Audit::log($decision === 'approved' ? 'penyesuaian_disetujui' : 'penyesuaian_ditolak', 'invoice', $inv->id,
                ['adjustment_id' => $adj->id, 'self_approved_sole_owner' => $self]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv));
        });
    }

    /** 409 when the invoice is void: it accepts no new money document (lines and history stay readable). */
    public static function voided(Invoice $inv): ?JsonResponse
    {
        return $inv->status === 'void'
            ? response()->json(['error' => 'invoice_void', 'message' => 'Tagihan ini sudah dibatalkan (void).'], 409) : null;
    }

    /**
     * POST /api/invoices/{id}/payments {payment_account_id, amount_rp, request_key?}: perm billing.adjust (front desk, kasir, owner).
     * Unit 5: money goes only to an active clinic account of this tenant usable at the invoice's branch; no free-text destination
     * (unknown fields = 422). Split = several payments. Never above the remaining balance (pending Rp0 requests do not reduce it).
     */
    public function pay(Request $request, string $id)
    {
        if ($bad = PaymentAccountController::unknownKeys($request, ['payment_account_id', 'amount_rp', 'request_key'])) {
            return $bad;
        }
        $d = $request->validate([
            'payment_account_id' => ['required', 'uuid'],
            'amount_rp' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'request_key' => ['nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($d, $id) {
            $inv = Invoice::lockForUpdate()->findOrFail($id); // serializes payments/adjustments: the balance check is race-free
            if (! Ctx::current()->coversBranch($inv->branch_id)) {
                return Audit::denied('branch:'.$inv->branch_id);
            }
            if ($e = self::voided($inv)) {
                return $e;
            }
            if (($d['request_key'] ?? null) && ($prev = InvoicePayment::where('request_key', $d['request_key'])->first())) {
                return $prev->invoice_id === $inv->id ? response()->json(Ledger::out($inv))
                    : response()->json(['message' => 'request_key sudah dipakai.', 'errors' => ['request_key' => ['Sudah dipakai.']]], 422);
            }
            if (! PaymentAccount::find($d['payment_account_id'])?->usableAt($inv->branch_id)) {
                return response()->json(['message' => 'Pilih akun pembayaran klinik yang aktif untuk cabang ini.',
                    'errors' => ['payment_account_id' => ['Akun klinik tidak dikenal, nonaktif, atau bukan untuk cabang ini.']]], 422);
            }
            if ($d['amount_rp'] > Ledger::totals($inv)['balance_rp']) {
                return response()->json(['error' => 'overpay', 'message' => 'Jumlah melebihi sisa tagihan.'], 422);
            }
            $p = InvoicePayment::create([...$d, 'invoice_id' => $inv->id, 'created_by' => Ctx::current()->userId, 'paid_at' => now()]);
            Audit::log('pembayaran', 'invoice', $inv->id, ['payment_id' => $p->id, 'payment_account_id' => $p->payment_account_id, 'amount_rp' => $p->amount_rp]);
            Ledger::syncStatus($inv);

            return response()->json(Ledger::out($inv), 201);
        });
    }
}
