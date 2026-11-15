<?php

use App\Modules\Clinical\Http\Controllers\BaselineController;
use App\Modules\Clinical\Http\Controllers\ChartController;
use App\Modules\Clinical\Http\Controllers\CodingSuggestionController;
use App\Modules\Clinical\Http\Controllers\ConsentController;
use App\Modules\Clinical\Http\Controllers\FindingController;
use App\Modules\Clinical\Http\Controllers\NoteController;
use App\Modules\Clinical\Http\Controllers\ProcedureController;
use App\Modules\Clinical\Http\Controllers\VisitController;
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
    // unit 3: history is append-only; replacing a restoration and correcting a record are new final rows
    Route::post('/procedures/{id}/replace', [ProcedureController::class, 'replace'])->middleware('perm:note.sign');
    Route::post('/procedures/{id}/corrections', [ProcedureController::class, 'correct'])->middleware('perm:note.sign');
    // unit A koreksi: corrections outside the clinic's window wait for the owner (DEVIATIONS #53)
    Route::get('/procedure-corrections/pending', [ProcedureController::class, 'pendingCorrections'])->middleware('perm:correction.approve');
    Route::post('/procedure-corrections/{id}/approve', [ProcedureController::class, 'decideCorrection'])->defaults('decision', 'disetujui')->middleware('perm:correction.approve');
    Route::post('/procedure-corrections/{id}/reject', [ProcedureController::class, 'decideCorrection'])->defaults('decision', 'ditolak')->middleware('perm:correction.approve');
    Route::delete('/procedures/{id}', [ProcedureController::class, 'destroy'])->middleware('perm:note.write');
    // unit 2: external entries made on a visit with `selesai` work that day wait for front desk / assistant
    Route::get('/procedures/pending-external', [ProcedureController::class, 'pendingExternal'])->middleware('perm:procedure.confirm_external');
    Route::post('/procedures/{id}/confirm-external', [ProcedureController::class, 'confirmExternal'])->middleware('perm:procedure.confirm_external');
    // unit 4: close under the invoice guard (Billing listens to VisitClosing); walk-in attendance cancel = the only no-invoice route
    Route::post('/visits/{id}/close', [VisitController::class, 'close'])->middleware('perm:appointment.transition');
    Route::post('/visits/{id}/cancel-attendance', [VisitController::class, 'cancelAttendance'])->middleware('perm:appointment.transition');
    Route::put('/visits/{id}/note', [NoteController::class, 'save'])->middleware('perm:note.write');
    // throttle: limits TOTP guessing on the sign confirmation
    Route::post('/visits/{id}/sign', [NoteController::class, 'sign'])->middleware(['perm:note.sign', 'throttle:10,1']);
    Route::post('/notes/{id}/corrections', [NoteController::class, 'correct'])->middleware('perm:note.sign');
    Route::post('/correction-requests/{id}/approve', [NoteController::class, 'approve'])->middleware('perm:correction.approve');
});
