<?php

use App\Modules\Audit\Http\Controllers\AuditEventController;
use Illuminate\Support\Facades\Route;

// Read only. No PATCH/PUT/DELETE for audit rows, ever (append-only; DEVIATIONS #52).
Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/audit-events', [AuditEventController::class, 'index'])->middleware('perm:audit.read');
});
