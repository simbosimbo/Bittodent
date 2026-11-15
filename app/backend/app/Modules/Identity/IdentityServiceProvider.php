<?php

namespace App\Modules\Identity;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Identity\Services\UserDirectoryService;
use App\Shared\Audit\Audit;
use App\Shared\ModuleServiceProvider;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;
use Laravel\Fortify\Fortify;

// Login (Fortify, headless) + mandatory TOTP + auth audit + DEV-ONLY quick login.
class IdentityServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [UserDirectory::class => UserDirectoryService::class];

    public function boot(): void
    {
        parent::boot();
        self::registerDevRoutes();

        Fortify::redirectUserForTwoFactorAuthenticationUsing(RedirectIfTwoFactorAuthenticatable::class);

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id').'|'.$request->ip());
        });

        RateLimiter::for('passkeys', function (Request $request) {
            $credentialId = $request->input('credential.id');

            return Limit::perMinute(10)->by(
                ($credentialId ?: $request->session()->getId()).'|'.$request->ip()
            );
        });

        // clinic (web guard) logins only; the platform guard logs to platform_audit_log itself (DEVIATIONS #61)
        Event::listen(Login::class, fn (Login $e) => $e->guard === 'web' && Audit::auth('login', $e->user->getAuthIdentifier()));
        Event::listen(Failed::class, fn (Failed $e) => $e->guard === 'web' && Audit::auth('login_gagal', $e->user?->getAuthIdentifier(), $e->credentials['email'] ?? null));
        Event::listen(TwoFactorAuthenticationFailed::class, fn ($e) => Audit::auth('2fa_gagal', $e->user->getAuthIdentifier()));
        Event::listen(Logout::class, fn (Logout $e) => $e->guard === 'web' && Audit::auth('logout', $e->user?->getAuthIdentifier()));
    }

    /** Quick login skips TOTP: only on APP_ENV=local with DEV_QUICK_LOGIN=true. Otherwise the routes do not exist (404). */
    public static function devQuickLoginEnabled(): bool
    {
        return app()->environment('local') && config('ehr.dev_quick_login') === true;
    }

    public static function registerDevRoutes(): void
    {
        if (self::devQuickLoginEnabled() && ! app()->routesAreCached()) {
            Route::group([], __DIR__.'/Routes/dev.php');
        }
    }
}
