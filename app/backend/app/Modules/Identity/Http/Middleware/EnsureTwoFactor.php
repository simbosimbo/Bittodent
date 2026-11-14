<?php

namespace App\Modules\Identity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// TOTP is mandatory for every role. Until confirmed, only Fortify's /user/two-factor-* routes work.
class EnsureTwoFactor
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()?->two_factor_confirmed_at === null) {
            return response()->json([
                'error' => 'two_factor_required',
                'message' => 'Aktifkan verifikasi dua langkah (TOTP) terlebih dahulu.',
            ], 403);
        }

        return $next($request);
    }
}
