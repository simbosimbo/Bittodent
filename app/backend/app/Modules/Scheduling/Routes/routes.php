<?php

use App\Modules\Scheduling\Http\Controllers\AppointmentController;
use App\Modules\Scheduling\Http\Controllers\PlannedAppointmentController;
use App\Modules\Scheduling\Http\Controllers\PublicBookingController;
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

// Public patient booking (no login). Tenant from the clinic slug only; throttled per IP, OTP sends also per phone (blind index).
Route::prefix('public/booking/{clinic}')->middleware(['throttle:booking', 'tenant.public'])->name('booking.')->group(function () {
    Route::get('/', [PublicBookingController::class, 'info']);
    Route::get('/slots', [PublicBookingController::class, 'slots']);
    Route::post('/start', [PublicBookingController::class, 'start'])->middleware('throttle:booking-otp');
    Route::post('/resend', [PublicBookingController::class, 'resend'])->middleware('throttle:booking-otp')->name('resend');
    Route::post('/verify', [PublicBookingController::class, 'verify']);
    Route::get('/manage/{token}', [PublicBookingController::class, 'show']);
    Route::post('/manage/{token}/cancel', [PublicBookingController::class, 'cancel']);
    Route::post('/manage/{token}/reschedule', [PublicBookingController::class, 'reschedule']);
});
