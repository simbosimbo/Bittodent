<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Per-clinic settings (owner only, perm settings.manage). Unit A koreksi: correction window in hours (DEVIATIONS #53).
class ClinicSettingsController extends Controller
{
    public const WINDOW_MIN = 1;

    public const WINDOW_MAX = 720; // 30 days

    /** GET /api/settings/clinic */
    public function show()
    {
        return response()->json(self::out(Tenant::findOrFail(Ctx::current()->tenant())));
    }

    /** PUT /api/settings/clinic {correction_window_hours}: audited old -> new. */
    public function update(Request $request)
    {
        $d = $request->validate(['correction_window_hours' => ['required', 'integer', 'between:'.self::WINDOW_MIN.','.self::WINDOW_MAX]]);

        return DB::transaction(function () use ($d) {
            $t = Tenant::lockForUpdate()->findOrFail(Ctx::current()->tenant());
            $from = (int) $t->correction_window_hours;
            $t->update(['correction_window_hours' => $d['correction_window_hours']]);
            Audit::log('ubah_pengaturan', 'tenant', $t->id, ['field' => 'correction_window_hours', 'from' => $from, 'to' => $d['correction_window_hours']]);

            return response()->json(self::out($t));
        });
    }

    private static function out(Tenant $t): array
    {
        return ['correction_window_hours' => (int) $t->correction_window_hours];
    }
}
