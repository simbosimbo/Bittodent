<?php

use App\Modules\IcdSuggestions\Http\Controllers\IcdSuggestionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant', 'perm:ai_draft.review'])->group(function () {
    Route::get('/visits/{id}/icd-suggestions', [IcdSuggestionController::class, 'forVisit']);
    Route::get('/patients/{id}/icd-suggestions', [IcdSuggestionController::class, 'forPatient']);
    Route::post('/visits/{id}/icd-suggestions/approve-all', [IcdSuggestionController::class, 'approveAll']);
    Route::post('/icd-suggestions/{id}/approve', [IcdSuggestionController::class, 'approve']);
    Route::post('/icd-suggestions/{id}/reject', [IcdSuggestionController::class, 'reject']);
});
