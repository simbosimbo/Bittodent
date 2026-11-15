<?php

use App\Modules\Identity\Http\Middleware\EnsureTwoFactor;
use App\Modules\Tenancy\Http\Middleware\TenantContext;
use App\Shared\Http\Middleware\NoStore;
use App\Shared\Http\Middleware\RequirePermission;
use App\Shared\Http\Middleware\SecurityHeaders;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting( // API routes: app/Modules/*/Routes/routes.php (ModuleServiceProvider)
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: fn () => require __DIR__.'/../routes/web.php', // /ready + SPA at / (no middleware group)
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
        $middleware->api(append: [NoStore::class]);
        $middleware->alias([
            '2fa' => EnsureTwoFactor::class,
            'tenant' => TenantContext::class,
            'perm' => RequirePermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        // QueryException messages embed bindings (names, ciphertext): log the SQL shape only.
        $exceptions->report(function (QueryException $e) {
            Log::error('query_failed', ['sqlstate' => $e->getCode(), 'sql' => $e->getSql()]);

            return false;
        });
    })->create();
