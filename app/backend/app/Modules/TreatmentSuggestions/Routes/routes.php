<?php

use App\Modules\TreatmentSuggestions\Http\Controllers\RuleController;
use App\Modules\TreatmentSuggestions\Http\Controllers\SuggestionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/visits/{id}/treatment-suggestions', [SuggestionController::class, 'forVisit'])->middleware('perm:ai_draft.review');
    Route::get('/patients/{id}/treatment-suggestions', [SuggestionController::class, 'forPatient'])->middleware('perm:ai_draft.review');
    Route::post('/visits/{id}/treatment-suggestions/approve-all', [SuggestionController::class, 'approveAll'])->middleware('perm:ai_draft.review');
    Route::post('/treatment-suggestions/{id}/approve', [SuggestionController::class, 'approve'])->middleware('perm:ai_draft.review');
    Route::post('/treatment-suggestions/{id}/reject', [SuggestionController::class, 'reject'])->middleware('perm:ai_draft.review');
    Route::get('/treatment-rules', [RuleController::class, 'index'])->middleware('perm:treatment_rule.manage');
    Route::post('/treatment-rules', [RuleController::class, 'store'])->middleware('perm:treatment_rule.manage');
});
