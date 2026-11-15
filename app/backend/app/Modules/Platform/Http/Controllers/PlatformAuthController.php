<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Services\ImpersonationSession;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Platform\Impersonation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

// Platform login: email + password + TOTP in one step (TOTP mandatory, no remember-me). Separate `platform` guard.
class PlatformAuthController extends Controller
{
    /** POST /api/platform/login {email, password, code} (throttled) */
    public function login(Request $request, TwoFactorAuthenticationProvider $totp)
    {
        $d = $request->validate(['email' => ['required', 'string', 'email', 'max:191'], 'password' => ['required', 'string'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/']]);
        $admin = PlatformAdmin::where('email', strtolower(trim($d['email'])))->first();
        $ok = $admin !== null && Hash::check($d['password'], $admin->password)
            && $admin->totp_secret !== null && $totp->verify($admin->totp_secret, $d['code']);
        if (! $ok) {
            Audit::platform('platform.login_gagal', 'platform_admin', $admin?->id);

            return response()->json(['error' => 'invalid_credentials', 'message' => 'Email, kata sandi, atau kode verifikasi salah.'], 422);
        }
        ImpersonationSession::end($request, 'login_platform'); // also drops any clinic login in this browser session
        Auth::guard('platform')->login($admin); // new session id
        Audit::platform('platform.login', 'platform_admin', $admin->id, platformAdminId: $admin->id);

        return response()->json(self::me($admin));
    }

    /** POST /api/platform/logout: ends any impersonation too */
    public function logout(Request $request)
    {
        $admin = $request->user('platform');
        ImpersonationSession::end($request, 'logout_platform');
        Audit::platform('platform.logout', 'platform_admin', $admin->id, platformAdminId: $admin->id);
        Auth::guard('platform')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    /** GET /api/platform/me */
    public function show(Request $request)
    {
        return response()->json(self::me($request->user('platform')));
    }

    public static function me(PlatformAdmin $admin): array
    {
        $imp = Impersonation::current();

        return ['id' => $admin->id, 'name' => $admin->name, 'email' => $admin->email, 'permissions' => $admin->permissions,
            'impersonation' => $imp->active()
                ? ['active' => true, 'tenant_id' => $imp->tenantId, 'user_id' => $imp->userId, 'started_at' => $imp->startedAt]
                : ['active' => false]];
    }
}
