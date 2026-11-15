<?php

use App\Modules\Agents\Http\Controllers\DraftReviewController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::post('/ai-drafts/{id}/approve', [DraftReviewController::class, 'approve'])->middleware('perm:ai_draft.review');
    Route::post('/ai-drafts/{id}/reject', [DraftReviewController::class, 'reject'])->middleware('perm:ai_draft.review');
});
