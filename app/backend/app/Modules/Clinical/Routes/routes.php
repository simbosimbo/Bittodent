<?php

use App\Modules\Clinical\Http\Controllers\BaselineController;
use App\Modules\Clinical\Http\Controllers\ChartController;
use App\Modules\Clinical\Http\Controllers\CodingSuggestionController;
use App\Modules\Clinical\Http\Controllers\ConsentController;
use App\Modules\Clinical\Http\Controllers\FindingController;
use App\Modules\Clinical\Http\Controllers\NoteController;
use App\Modules\Clinical\Http\Controllers\ProcedureController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/patients/{id}/chart', [ChartController::class, 'show'])->middleware('perm:note.read');
    Route::get('/patients/{id}/baseline', [BaselineController::class, 'show'])->middleware('perm:note.read');
    Route::put('/patients/{id}/baseline', [BaselineController::class, 'store'])->middleware('perm:note.write');
    Route::post('/patients/{id}/consents', [ConsentController::class, 'store'])->middleware('perm:note.write');
    Route::post('/appointments/{id}/visit', [ChartController::class, 'visitFromAppointment'])->middleware('perm:note.write');
    Route::get('/coding-suggestions', [CodingSuggestionController::class, 'index'])->middleware('perm:note.write'); // used while charting
    Route::post('/visits/{id}/findings', [FindingController::class, 'store'])->middleware('perm:note.write');
    Route::patch('/findings/{id}', [FindingController::class, 'update'])->middleware('perm:note.write');
    Route::delete('/findings/{id}', [FindingController::class, 'destroy'])->middleware('perm:note.write');
    // treatments (procedure_record); a finding status route no longer exists: findings are visual conditions only
    Route::post('/visits/{id}/procedures', [ProcedureController::class, 'store'])->middleware('perm:note.write');
    Route::patch('/procedures/{id}', [ProcedureController::class, 'update'])->middleware('perm:note.write');
    Route::post('/procedures/{id}/status', [ProcedureController::class, 'changeStatus'])->middleware('perm:note.sign');
    Route::delete('/procedures/{id}', [ProcedureController::class, 'destroy'])->middleware('perm:note.write');
    Route::put('/visits/{id}/note', [NoteController::class, 'save'])->middleware('perm:note.write');
    // throttle: limits TOTP guessing on the sign confirmation
    Route::post('/visits/{id}/sign', [NoteController::class, 'sign'])->middleware(['perm:note.sign', 'throttle:10,1']);
    Route::post('/notes/{id}/corrections', [NoteController::class, 'correct'])->middleware('perm:note.sign');
    Route::post('/correction-requests/{id}/approve', [NoteController::class, 'approve'])->middleware('perm:correction.approve');
});
