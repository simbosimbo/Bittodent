<?php

use App\Modules\Ktp\Http\Controllers\KtpController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    // Every role that may create/update a patient has patient.read; photos: patient.create (same roles as patient.update).
    Route::post('/ktp/check', [KtpController::class, 'check'])->middleware('perm:patient.read');
    Route::post('/ktp/photos', [KtpController::class, 'storePhoto'])->middleware('perm:patient.create');
    Route::put('/patients/{id}/ktp', [KtpController::class, 'update'])->middleware('perm:patient.update');
    Route::get('/patients/{id}/ktp', [KtpController::class, 'show'])->middleware('perm:patient.ktp.view');
    Route::get('/patients/{id}/ktp/attachment', [KtpController::class, 'attachment'])->middleware('perm:patient.ktp.view');
    Route::get('/patients/{id}/ktp/photo', [KtpController::class, 'showPhoto'])->middleware('perm:patient.ktp.view');
});
