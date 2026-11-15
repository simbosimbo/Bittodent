<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Per-clinic settings (owner only, perm settings.manage). Unit A koreksi: correction window in hours (DEVIATIONS #53);
// Selesai: PIN required at Selesai, default off (DEVIATIONS #54).
class ClinicSettingsController extends Controller
{
    public const WINDOW_MIN = 1;

    public const WINDOW_MAX = 720; // 30 days

    /** GET /api/settings/clinic */
    public function show()
    {
        return response()->json(self::out(Tenant::findOrFail(Ctx::current()->tenant())));
    }

    /** PUT /api/settings/clinic {correction_window_hours?, selesai_pin_required?}: each changed field audited old -> new. */
    public function update(Request $request)
    {
        $d = $request->validate([
            'correction_window_hours' => ['required_without:selesai_pin_required', 'integer', 'between:'.self::WINDOW_MIN.','.self::WINDOW_MAX],
            'selesai_pin_required' => ['sometimes', 'boolean'],
        ]);

        return DB::transaction(function () use ($d) {
            $t = Tenant::lockForUpdate()->findOrFail(Ctx::current()->tenant());
            $from = self::out($t);
            $t->update($d);
            foreach (array_diff_assoc(self::out($t), $from) as $field => $to) {
                Audit::log('ubah_pengaturan', 'tenant', $t->id, ['field' => $field, 'from' => $from[$field], 'to' => $to]);
            }

            return response()->json(self::out($t));
        });
    }

    private static function out(Tenant $t): array
    {
        return ['correction_window_hours' => (int) $t->correction_window_hours, 'selesai_pin_required' => (bool) $t->selesai_pin_required];
    }
}
