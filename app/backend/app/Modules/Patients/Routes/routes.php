<?php

use App\Modules\Patients\Http\Controllers\FamilyController;
use App\Modules\Patients\Http\Controllers\MedicalHistoryController;
use App\Modules\Patients\Http\Controllers\PatientController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/patients', [PatientController::class, 'index'])->middleware('perm:patient.read');
    Route::post('/patients', [PatientController::class, 'store'])->middleware('perm:patient.create');
    Route::get('/patients/{id}', [PatientController::class, 'show'])->middleware('perm:patient.read');
    Route::get('/patients/{id}/family', [FamilyController::class, 'show'])->middleware('perm:patient.read');
    Route::put('/patients/{id}/family', [FamilyController::class, 'update'])->middleware('perm:patient.update');
    Route::post('/patients/{id}/guardians', [FamilyController::class, 'addGuardian'])->middleware('perm:patient.update');
    // Alerts: every patient.read role (safety header); non-clinical roles get the minimum set (see controller).
    Route::get('/patients/{id}/alerts', [MedicalHistoryController::class, 'alerts'])->middleware('perm:patient.read');
    // Full medical history = health data: clinical roles only.
    Route::get('/patients/{id}/medical-history', [MedicalHistoryController::class, 'show'])->middleware('perm:note.read');
    Route::put('/patients/{id}/medical-history', [MedicalHistoryController::class, 'store'])->middleware('perm:note.write');
});
