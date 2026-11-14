<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\IdentityServiceProvider;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

// DEV ONLY: log in a seeded synthetic account without TOTP. Route exists only on local + DEV_QUICK_LOGIN=true.
class DevQuickLoginController extends Controller
{
    private const SEED_EMAIL = '/^[a-z0-9.]+@[a-z0-9-]+\.test$/';

    public function status()
    {
        abort_unless(IdentityServiceProvider::devQuickLoginEnabled(), 404); // second lock if routes were cached while on

        return response()->json([
            'quick_login' => true,
            'accounts' => User::where('email', 'like', '%.test')->whereNotNull('two_factor_confirmed_at')
                ->orderBy('email')->get(['email', 'name'])->filter(fn ($u) => preg_match(self::SEED_EMAIL, $u->email))->values(),
        ]);
    }

    public function login(Request $request)
    {
        abort_unless(IdentityServiceProvider::devQuickLoginEnabled(), 404);
        $email = (string) $request->validate(['user_email' => ['required', 'string', 'max:100']])['user_email'];
        $user = preg_match(self::SEED_EMAIL, $email) ? User::where('email', $email)->first() : null;
        if ($user === null) {
            return response()->json(['error' => 'not_allowed', 'message' => 'Masuk cepat hanya untuk akun seed *.test.'], 422);
        }
        Auth::guard('web')->login($user); // fires Login => auth_event 'login'
        $request->session()->regenerate();
        $request->session()->put('dev_quick_login', true);
        Audit::auth('dev_quick_login', $user->id);

        return response()->noContent();
    }
}
