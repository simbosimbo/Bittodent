<?php

namespace App\Modules\Reporting\Http\Controllers;

use App\Modules\Billing\Contracts\RevenueFacts;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

// Boards KL07-KL09: owner revenue report for the ACTIVE branch (perm reporting.read = owner only; kasir has no Laporan tab).
// Revenue = money received (payments); per dokter / per tindakan = lines billed in the period; piutang = open balances (any age).
class RevenueReportController extends Controller
{
    private const PERIODS = ['today', '7d', 'month'];

    /** GET /api/reports/revenue?period=today|7d|month (default month) */
    public function show(Request $request, RevenueFacts $facts, TenancyDirectory $tenancy, UserDirectory $users, PatientDirectory $patients)
    {
        $period = $request->validate(['period' => ['nullable', 'in:'.implode(',', self::PERIODS)]])['period'] ?? 'month';
        $branch = $tenancy->branchOrFail(Ctx::current()->branchId);
        $tz = $branch['timezone'] ?: 'Asia/Jakarta';
        $today = CarbonImmutable::now($tz)->startOfDay();
        $from = match ($period) {
            'today' => $today, '7d' => $today->subDays(6), default => $today->startOfMonth()
        };
        $to = $today->addDay();
        $prevFrom = $from->sub($from->diff($to)); // same length, right before (KL07 "+8% vs ...")

        $pays = collect($facts->payments($from->utc(), $to->utc(), $branch['id']));
        $prev = collect($facts->payments($prevFrom->utc(), $from->utc(), $branch['id']));
        $week = collect($facts->payments($today->subDays(6)->utc(), $to->utc(), $branch['id']))
            ->groupBy(fn ($p) => CarbonImmutable::parse($p['paid_at'])->setTimezone($tz)->toDateString());
        $lines = collect($facts->lines($from->utc(), $to->utc(), $branch['id']));
        $owed = collect($facts->receivables($branch['id']));
        $shifts = collect($facts->shiftDifferences($from->utc(), $to->utc(), $branch['id']));
        $userNames = collect($users->namesByIds($lines->pluck('doctor_id')->merge($shifts->pluck('user_id'))->filter()->unique()->values()->all()))->pluck('name', 'id');
        $patientNames = collect($patients->namesByIds($owed->pluck('patient_id')->unique()->values()->all()))->pluck('name', 'id');

        Audit::log('laporan_dibuka', 'laporan_pendapatan', null, ['branch_id' => $branch['id'], 'period' => $period]);

        return response()->json([
            'period' => $period, 'from' => $from->toDateString(), 'to' => $today->toDateString(), 'branch' => ['id' => $branch['id'], 'name' => $branch['name']],
            'revenue_rp' => (int) $pays->sum('amount_rp'), 'prev_revenue_rp' => (int) $prev->sum('amount_rp'), 'transactions' => $pays->count(),
            'receivable_rp' => (int) $owed->sum('balance_rp'), 'receivable_patients' => $owed->pluck('patient_id')->unique()->count(),
            'daily' => collect(range(6, 0))->map(fn ($n) => ['date' => $d = $today->subDays($n)->toDateString(), 'amount_rp' => (int) ($week[$d] ?? collect())->sum('amount_rp')])->values(),
            'by_method' => $pays->groupBy(fn ($p) => $p['kind'].'|'.(in_array($p['kind'], ['edc', 'transfer'], true) ? $p['bank_name'] : ''))
                ->map(fn ($ps, $k) => ['kind' => explode('|', $k)[0], 'bank_name' => explode('|', $k)[1] ?: null, 'amount_rp' => (int) $ps->sum('amount_rp'), 'count' => $ps->count()])
                ->sortByDesc('amount_rp')->values(),
            'by_doctor' => $lines->groupBy(fn ($l) => $l['doctor_id'] ?? '')->map(fn ($ls, $id) => ['doctor_id' => $id ?: null,
                'name' => $userNames[$id] ?? 'Tanpa dokter', 'procedures' => $ls->count(), 'patients' => $ls->pluck('patient_id')->unique()->count(),
                'amount_rp' => (int) $ls->sum('price_rp')])->sortByDesc('amount_rp')->values(),
            'by_procedure' => $lines->groupBy('procedure_name')->map(fn ($ls, $name) => ['name' => $name, 'count' => $ls->count(), 'amount_rp' => (int) $ls->sum('price_rp')])
                ->sortByDesc('amount_rp')->values(),
            'receivables' => $owed->map(fn ($r) => ['patient_name' => $patientNames[$r['patient_id']] ?? 'Pasien',
                'days' => (int) CarbonImmutable::parse($r['created_at'])->setTimezone($tz)->startOfDay()->diffInDays($today), 'items' => $r['items'],
                'amount_rp' => $r['balance_rp']])->sortByDesc('days')->take(500)->values(), // shown list only; receivable_rp counts every open invoice
            'shift_differences' => $shifts->map(fn ($s) => ['user_name' => $userNames[$s['user_id']] ?? 'Kasir', 'closed_at' => $s['closed_at'],
                'difference_rp' => $s['difference_rp'], 'reason' => $s['reason']])->values(),
        ]);
    }
}
