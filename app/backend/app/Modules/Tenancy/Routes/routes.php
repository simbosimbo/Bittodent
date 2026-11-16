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
    Route::post('/settings/clinic/logo', [ClinicSettingsController::class, 'uploadLogo'])->middleware('perm:settings.manage');
    Route::get('/clinic/letterhead', [ClinicSettingsController::class, 'letterhead']); // KL05/KL09 kop: every clinic role
    Route::get('/clinic/logo', [ClinicSettingsController::class, 'logo']);
});
