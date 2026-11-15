<?php

use App\Modules\Scribe\Http\Controllers\ScribeController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/visits/{id}/scribe', [ScribeController::class, 'show'])->middleware('perm:note.read');
    // ai_draft.review is dentist-only (and those dentists already have note.write).
    Route::middleware('perm:ai_draft.review')->group(function () {
        Route::post('/visits/{id}/scribe', [ScribeController::class, 'store']);
        Route::post('/scribe/sessions/{id}/process', [ScribeController::class, 'process']);
        Route::post('/scribe/drafts/{id}/approve', [ScribeController::class, 'approve']);
        Route::post('/scribe/drafts/{id}/reject', [ScribeController::class, 'reject']);
    });
});
