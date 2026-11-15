<?php

namespace App\Modules\Platform\Services;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\PlatformImpersonation;
use App\Shared\Audit\Audit;
use App\Shared\Platform\Impersonation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

// Start/stop of an impersonation. During it the session holds BOTH logins: `platform` (the admin) and `web` (the clinic owner,
// so auth:sanctum + TenantContext + BelongsToTenant work unchanged) plus the platform_impersonation row id.
final class ImpersonationSession
{
    public const KEY = 'platform_impersonation_id';

    public static function load(PlatformImpersonation $row, PlatformAdmin $admin): void
    {
        Impersonation::current()->set($row->id, $admin->id, $admin->name, $row->target_tenant_id, $row->target_user_id,
            $row->started_at->toIso8601String());
    }

    public static function start(Request $request, PlatformAdmin $admin, string $tenantId, string $userId): PlatformImpersonation
    {
        self::end($request, 'diganti');
        $row = PlatformImpersonation::create(['platform_admin_id' => $admin->id, 'target_tenant_id' => $tenantId,
            'target_user_id' => $userId, 'started_at' => now()]);
        self::load($row->fresh(), $admin); // state first: the web Login event below is logged to the platform log, not auth_event
        Audit::platform('impersonation.start', 'user', $userId);
        Auth::guard('web')->loginUsingId($userId); // also migrates the session id (fixation)
        $request->session()->put([self::KEY => $row->id, 'tenant_id' => $tenantId]);
        $request->session()->forget('branch_id');

        return $row;
    }

    /** Ends the active impersonation (if any) and drops the clinic-user login without firing auth events. New session id. */
    public static function end(Request $request, string $reason): void
    {
        $id = $request->session()->pull(self::KEY);
        $row = $id === null ? null : PlatformImpersonation::with('admin')->whereKey($id)->whereNull('ended_at')->first();
        if ($row !== null) {
            self::load($row, $row->admin);
            $row->update(['ended_at' => now(), 'end_reason' => $reason]);
            Audit::platform('impersonation.stop', 'user', $row->target_user_id, ['reason' => $reason]);
        }
        $request->session()->forget([Auth::guard('web')->getName(), 'tenant_id', 'branch_id']);
        Auth::forgetGuards(); // guards cached the clinic user earlier in this request (Sanctum AuthenticateSession): re-read the session
        Impersonation::current()->clear();
        $request->session()->migrate(true);
    }
}
