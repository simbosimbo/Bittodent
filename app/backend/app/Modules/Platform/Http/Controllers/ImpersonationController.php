<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Services\ImpersonationSession;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;

// Impersonation targets ONLY active `owner` members (the clinic admin role) of the chosen clinic. A user who is owner + dentist
// may be targeted; every signature action is blocked during impersonation anyway (not_impersonating, DEVIATIONS #61).
class ImpersonationController extends Controller
{
    private const ADMIN_ROLE = 'owner';

    /** GET /api/platform/tenants: clinics + their owner users (id, name). No patient data. */
    public function tenants(Request $request, TenancyDirectory $tenancy, UserDirectory $users)
    {
        if ($denied = self::denied($request)) {
            return $denied;
        }

        return response()->json(['tenants' => array_map(fn ($t) => [...$t,
            'admins' => $users->namesByIds(self::ownerIds($tenancy, $t['id']))], $tenancy->allTenants())]);
    }

    /** POST /api/platform/impersonate {tenant_id, user_id} */
    public function start(Request $request, TenancyDirectory $tenancy)
    {
        if ($denied = self::denied($request)) {
            return $denied;
        }
        $d = $request->validate(['tenant_id' => ['required', 'uuid'], 'user_id' => ['required', 'uuid']]);
        if (! in_array($d['user_id'], self::ownerIds($tenancy, $d['tenant_id']), true)) {
            return response()->json(['error' => 'invalid_target',
                'message' => 'Pengguna ini bukan admin (pemilik) aktif klinik tersebut.'], 422);
        }
        $row = ImpersonationSession::start($request, $request->user('platform'), $d['tenant_id'], $d['user_id']);

        return response()->json(['impersonation' => ['id' => $row->id, 'tenant_id' => $d['tenant_id'], 'user_id' => $d['user_id']]], 201);
    }

    /** POST /api/platform/impersonate/stop: back to the plain platform session; the clinic login is dropped. */
    public function stop(Request $request)
    {
        ImpersonationSession::end($request, 'berhenti');

        return response()->json(PlatformAuthController::me($request->user('platform')));
    }

    private static function ownerIds(TenancyDirectory $tenancy, string $tenantId): array
    {
        return Ctx::runAs($tenantId, fn () => $tenancy->activeUserIdsWithRole(self::ADMIN_ROLE));
    }

    private static function denied(Request $request)
    {
        return $request->user('platform')->hasPermission(PlatformAdmin::IMPERSONATE) ? null
            : response()->json(['error' => 'forbidden', 'message' => 'Akun platform ini tidak punya izin impersonasi.'], 403);
    }
}
