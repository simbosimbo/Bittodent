<?php

namespace App\Modules\Reporting\Http\Controllers;

use App\Modules\Reporting\Services\IntegrityReport;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

// Unit 6: owner integrity report per dentist + alerts queue (perm reporting.read = owner only). Every opening is audited.
class IntegrityReportController extends Controller
{
    /** GET /api/reports/integrity?from=YYYY-MM-DD&to=YYYY-MM-DD (local days of the active branch, inclusive; default = this month) */
    public function show(Request $request, IntegrityReport $report, TenancyDirectory $tenancy)
    {
        $d = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $tz = $tenancy->branchOrFail(Ctx::current()->branchId)['timezone'] ?: 'Asia/Jakarta';
        $now = CarbonImmutable::now($tz);
        $from = isset($d['from']) ? CarbonImmutable::parse($d['from'], $tz) : $now->startOfMonth();
        $to = isset($d['to']) ? CarbonImmutable::parse($d['to'], $tz) : $now;
        if ($from->diffInDays($to) > 366) {
            return response()->json(['message' => 'Rentang maksimal 1 tahun.', 'errors' => ['to' => ['Rentang maksimal 1 tahun.']]], 422);
        }
        $out = $report->build($from->startOfDay()->utc(), $to->addDay()->startOfDay()->utc(), Ctx::current()->branchIds);
        Audit::log('laporan_dibuka', 'laporan_integritas', null, ['from' => $from->toDateString(), 'to' => $to->toDateString(),
            'alerts' => count($out['alerts'])]);

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'timezone' => $tz, ...$out]);
    }
}
