<?php

use App\Modules\ClinicalSummary\Http\Controllers\SummaryController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::post('/patients/{id}/ai-summary', [SummaryController::class, 'store'])->middleware(['perm:summary.generate', 'throttle:ai-summary']);
    Route::get('/patients/{id}/ai-summary', [SummaryController::class, 'show'])->middleware('perm:summary.generate');
});
