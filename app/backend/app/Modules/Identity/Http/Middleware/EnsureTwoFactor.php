<?php

namespace App\Modules\Identity\Http\Middleware;

use App\Shared\Platform\Impersonation;
use Closure;
use Illuminate\Http\Request;

// TOTP is mandatory for every role. Until confirmed, only Fortify's /user/two-factor-* routes work.
// Exception (DEVIATIONS #61): a verified impersonation; the platform admin passed their own TOTP, the clinic user's is not asked.
class EnsureTwoFactor
{
    public function handle(Request $request, Closure $next)
    {
        if (! Impersonation::current()->active() && $request->user()?->two_factor_confirmed_at === null) {
            return response()->json([
                'error' => 'two_factor_required',
                'message' => 'Aktifkan verifikasi dua langkah (TOTP) terlebih dahulu.',
            ], 403);
        }

        return $next($request);
    }
}
