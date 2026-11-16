<?php

use App\Modules\Reporting\Http\Controllers\IntegrityReportController;
use App\Modules\Reporting\Http\Controllers\RevenueReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/reports/integrity', [IntegrityReportController::class, 'show'])->middleware('perm:reporting.read'); // unit 6, owner only
    Route::get('/reports/revenue', [RevenueReportController::class, 'show'])->middleware('perm:reporting.read'); // KL07-KL09, owner only
});
