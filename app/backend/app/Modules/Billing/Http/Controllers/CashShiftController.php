<?php

namespace App\Modules\Billing\Http\Controllers;

use App\Modules\Billing\Models\CashShift;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\PaymentAccount;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Board KL06: the cashier's own shift in the ACTIVE branch. Cash in the drawer is separate from QRIS/debit/transfer/BPJS/asuransi;
// debit and transfer split per bank. A difference needs a reason and the cashier closes alone; the owner only sees it (report).
class CashShiftController extends Controller
{
    /** GET /api/cash-shift/current: my open shift here (with a live recap), or null. */
    public function current()
    {
        $s = self::open();

        return response()->json(['shift' => $s ? self::out($s) : null]);
    }

    /** POST /api/cash-shift {opening_cash_rp}: one open shift per cashier per branch. */
    public function store(Request $request)
    {
        $d = $request->validate(['opening_cash_rp' => ['required', 'integer', 'min:0', 'max:1000000000']]);
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $ctx) {
            if ($s = self::open(true)) {
                return response()->json(['error' => 'shift_open', 'message' => 'Shift Anda di cabang ini masih terbuka.', 'shift' => self::out($s)], 409);
            }
            $s = CashShift::create([...$d, 'branch_id' => $ctx->branchId, 'user_id' => $ctx->userId, 'opened_at' => now()]);
            Audit::log('shift_dibuka', 'cash_shift', $s->id, ['branch_id' => $s->branch_id, 'opening_cash_rp' => $s->opening_cash_rp]);

            return response()->json(['shift' => self::out($s)], 201);
        });
    }

    /** POST /api/cash-shift/{id}/close {counted_cash_rp, reason?}: reason required when counted != expected. */
    public function close(Request $request, string $id)
    {
        $d = $request->validate(['counted_cash_rp' => ['required', 'integer', 'min:0', 'max:1000000000'], 'reason' => ['nullable', 'string', 'max:500']]);

        return DB::transaction(function () use ($d, $id) {
            $s = CashShift::lockForUpdate()->findOrFail($id);
            if ($s->user_id !== Ctx::current()->userId) {
                return Audit::denied('cash_shift:'.$s->id); // only the cashier who opened it closes it
            }
            if ($s->closed_at) {
                return response()->json(['error' => 'shift_closed', 'message' => 'Shift sudah ditutup.'], 409);
            }
            $r = self::recap($s);
            $diff = $d['counted_cash_rp'] - $r['expected_cash_rp'];
            if ($diff !== 0 && mb_strlen(trim($d['reason'] ?? '')) < 5) {
                return response()->json(['message' => 'Ada selisih kas: isi alasan.', 'errors' => ['reason' => ['Wajib bila ada selisih (min. 5 huruf).']]], 422);
            }
            $s->update(['closed_at' => now(), 'expected_cash_rp' => $r['expected_cash_rp'], 'counted_cash_rp' => $d['counted_cash_rp'],
                'difference_rp' => $diff, 'reason' => $diff !== 0 ? trim($d['reason']) : null, 'summary' => $r['methods']]);
            Audit::log('shift_ditutup', 'cash_shift', $s->id, ['difference_rp' => $diff, 'counted_cash_rp' => $d['counted_cash_rp']]);

            return response()->json(['shift' => self::out($s)]);
        });
    }

    private static function open(bool $lock = false): ?CashShift
    {
        $ctx = Ctx::current();
        $q = CashShift::where('branch_id', $ctx->branchId)->where('user_id', $ctx->userId)->whereNull('closed_at');

        return ($lock ? $q->lockForUpdate() : $q)->first();
    }

    /** Payments this cashier recorded in this branch during the shift, per method (+ bank for edc/transfer). Integer rupiah. */
    private static function recap(CashShift $s): array
    {
        $pays = InvoicePayment::where('created_by', $s->user_id)->where('paid_at', '>=', $s->opened_at)
            ->when($s->closed_at, fn ($q) => $q->where('paid_at', '<', $s->closed_at))
            ->whereIn('invoice_id', Invoice::where('branch_id', $s->branch_id)->select('id'))->get(['payment_account_id', 'amount_rp']);
        $acc = PaymentAccount::whereIn('id', $pays->pluck('payment_account_id')->unique())->get()->keyBy('id');
        $methods = $pays->groupBy(fn ($p) => $acc[$p->payment_account_id]->kind.'|'.(in_array($acc[$p->payment_account_id]->kind, ['edc', 'transfer'], true)
            ? $acc[$p->payment_account_id]->bank_name : ''))
            ->map(function ($ps, $key) {
                [$kind, $bank] = explode('|', $key);

                return ['kind' => $kind, 'bank_name' => $bank ?: null, 'amount_rp' => (int) $ps->sum('amount_rp'), 'count' => $ps->count()];
            })->sortBy(fn ($m) => array_search($m['kind'], PaymentAccount::KINDS, true).$m['bank_name'])->values()->all();
        $cash = (int) collect($methods)->where('kind', 'tunai')->sum('amount_rp');

        return ['methods' => $methods, 'cash_in_rp' => $cash, 'expected_cash_rp' => $s->opening_cash_rp + $cash,
            'total_rp' => (int) collect($methods)->sum('amount_rp')];
    }

    private static function out(CashShift $s): array
    {
        $live = $s->closed_at ? ['methods' => $s->summary ?? [], 'cash_in_rp' => $s->expected_cash_rp - $s->opening_cash_rp,
            'expected_cash_rp' => $s->expected_cash_rp, 'total_rp' => (int) collect($s->summary ?? [])->sum('amount_rp')] : self::recap($s);

        return [...$s->only(['id', 'branch_id', 'user_id', 'opening_cash_rp', 'opened_at', 'closed_at', 'counted_cash_rp', 'difference_rp', 'reason']), ...$live];
    }
}
