<?php

use App\Modules\Platform\Http\Controllers\ImpersonationController;
use App\Modules\Platform\Http\Controllers\PlatformAuthController;
use Illuminate\Support\Facades\Route;

// Platform superadmin (DEVIATIONS #61). `platform` guard only: a clinic user (web guard) gets 401 here, and a platform admin
// without an impersonation gets 401 on every tenant route (auth:sanctum checks the web guard only).
Route::prefix('platform')->group(function () {
    Route::post('/login', [PlatformAuthController::class, 'login'])->middleware('throttle:5,1,platform_login');
    Route::middleware('auth:platform')->group(function () {
        Route::post('/logout', [PlatformAuthController::class, 'logout']);
        Route::get('/me', [PlatformAuthController::class, 'show']);
        Route::get('/tenants', [ImpersonationController::class, 'tenants']);
        Route::post('/impersonate', [ImpersonationController::class, 'start']);
        Route::post('/impersonate/stop', [ImpersonationController::class, 'stop']);
    });
});
