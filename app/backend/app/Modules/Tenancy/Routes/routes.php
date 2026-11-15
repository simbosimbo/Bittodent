<?php

use App\Modules\Tenancy\Http\Controllers\ClinicSettingsController;
use App\Modules\Tenancy\Http\Controllers\DentistProfileController;
use App\Modules\Tenancy\Http\Controllers\MeController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::post('/session/branch', [MeController::class, 'switchBranch']);
    Route::put('/dentists/{userId}/profile', [DentistProfileController::class, 'update'])->middleware('perm:tariff.manage');
    Route::get('/settings/clinic', [ClinicSettingsController::class, 'show'])->middleware('perm:settings.manage');
    Route::put('/settings/clinic', [ClinicSettingsController::class, 'update'])->middleware('perm:settings.manage');
    Route::put('/settings/branches/{id}', [ClinicSettingsController::class, 'updateBranch'])->middleware('perm:settings.manage');
});
