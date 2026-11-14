<?php

use App\Modules\Identity\Http\Controllers\DevQuickLoginController;
use Illuminate\Support\Facades\Route;

// DEV ONLY. Loaded by IdentityServiceProvider::registerDevRoutes() only when APP_ENV=local AND DEV_QUICK_LOGIN=true.
Route::get('/api/dev/status', [DevQuickLoginController::class, 'status'])->middleware('api');
Route::post('/dev/quick-login', [DevQuickLoginController::class, 'login'])->middleware('web');
