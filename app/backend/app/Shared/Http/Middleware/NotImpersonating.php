<?php

namespace App\Shared\Http\Middleware;

use App\Shared\Audit\Audit;
use App\Shared\Platform\Impersonation;
use Closure;
use Illuminate\Http\Request;

// ->middleware('not_impersonating'): signatures, correction decisions and account security (password/TOTP/PIN) are never done
// by a platform admin acting as a clinic user (DEVIATIONS #61). The attempt goes to the platform log only.
class NotImpersonating
{
    public function handle(Request $request, Closure $next)
    {
        if (! Impersonation::current()->active()) {
            return $next($request);
        }
        Audit::platform('platform.blocked', 'route', null, ['route' => $request->route()?->uri()]);

        return response()->json(['error' => 'impersonation_blocked',
            'message' => 'Tindakan ini tidak boleh dilakukan saat tim platform masuk sebagai admin klinik. '
                .'Tanda tangan, keputusan koreksi, dan keamanan akun (kata sandi, verifikasi dua langkah, PIN) hanya oleh pemilik akun sendiri.'], 403);
    }
}
