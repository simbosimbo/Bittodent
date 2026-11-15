<?php

use App\Modules\Billing\Http\Controllers\InvoiceController;
use App\Modules\Billing\Http\Controllers\PaymentAccountController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/visits/{id}/invoice', [InvoiceController::class, 'forVisit'])->middleware('perm:billing.read');
    Route::get('/invoices/{id}', [InvoiceController::class, 'show'])->middleware('perm:billing.read');
    Route::post('/invoices/{id}/adjustments', [InvoiceController::class, 'adjust'])->middleware('perm:billing.adjust');
    // unit 4: Rp0 (100% discount / full write-off) waits for an owner
    Route::post('/invoice-adjustments/{id}/approve', [InvoiceController::class, 'decide'])->defaults('decision', 'approved')->middleware('perm:billing.approve_zero');
    Route::post('/invoice-adjustments/{id}/reject', [InvoiceController::class, 'decide'])->defaults('decision', 'rejected')->middleware('perm:billing.approve_zero');
    // unit 5: payments only into clinic-owned accounts; owner manages the accounts
    Route::post('/invoices/{id}/payments', [InvoiceController::class, 'pay'])->middleware('perm:billing.adjust');
    Route::get('/payment-accounts', [PaymentAccountController::class, 'index'])->middleware('perm:billing.read');
    Route::post('/payment-accounts', [PaymentAccountController::class, 'store'])->middleware('perm:billing.accounts');
    Route::patch('/payment-accounts/{id}', [PaymentAccountController::class, 'update'])->middleware('perm:billing.accounts');
});
