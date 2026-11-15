<?php

use App\Modules\Billing\Http\Controllers\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/visits/{id}/invoice', [InvoiceController::class, 'forVisit'])->middleware('perm:billing.read');
    Route::get('/invoices/{id}', [InvoiceController::class, 'show'])->middleware('perm:billing.read');
    Route::post('/invoices/{id}/adjustments', [InvoiceController::class, 'adjust'])->middleware('perm:billing.adjust');
    // unit 4: Rp0 (100% discount / full write-off) waits for an owner
    Route::post('/invoice-adjustments/{id}/approve', [InvoiceController::class, 'decide'])->defaults('decision', 'approved')->middleware('perm:billing.approve_zero');
    Route::post('/invoice-adjustments/{id}/reject', [InvoiceController::class, 'decide'])->defaults('decision', 'rejected')->middleware('perm:billing.approve_zero');
});
