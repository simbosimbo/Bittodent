<?php

use App\Modules\Scheduling\Http\Controllers\AppointmentController;
use App\Modules\Scheduling\Http\Controllers\PlannedAppointmentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/dentists', [AppointmentController::class, 'dentists'])->middleware('perm:appointment.read');
    Route::get('/schedule', [AppointmentController::class, 'schedule'])->middleware('perm:appointment.read');
    Route::post('/appointments', [AppointmentController::class, 'store'])->middleware('perm:appointment.create');
    Route::post('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule'])->middleware('perm:appointment.create');
    Route::post('/patients/{id}/planned-appointments', [PlannedAppointmentController::class, 'store'])->middleware('perm:appointment.plan');
    Route::get('/planned-appointments', [PlannedAppointmentController::class, 'index'])->middleware('perm:appointment.read');
    Route::post('/planned-appointments/{id}/schedule', [PlannedAppointmentController::class, 'schedule'])->middleware('perm:appointment.create');
    Route::post('/appointments/{id}/transition', [AppointmentController::class, 'transition'])->middleware('perm:appointment.transition');
});
