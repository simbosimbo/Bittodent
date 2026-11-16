<?php

use App\Modules\Billing\Http\Controllers\CashShiftController;
use App\Modules\Billing\Http\Controllers\CreditNoteController;
use App\Modules\Billing\Http\Controllers\InvoiceController;
use App\Modules\Billing\Http\Controllers\PaymentAccountController;
use App\Modules\Billing\Http\Controllers\RefundController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/billing/daily-revenue', [InvoiceController::class, 'dailyRevenue'])->middleware('perm:billing.read');
    Route::get('/billing/invoices', [InvoiceController::class, 'index'])->middleware('perm:billing.read');
    Route::get('/billing/invoice-status', [InvoiceController::class, 'statusForVisits'])->middleware('perm:billing.read');
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
    Route::post('/payment-accounts/{id}/qris-image', [PaymentAccountController::class, 'uploadQris'])->middleware('perm:billing.accounts');
    Route::get('/payment-accounts/{id}/qris-image', [PaymentAccountController::class, 'qrisImage'])->middleware('perm:billing.read');
    // unit B koreksi: credit notes, void, line corrections, Rp0 tariff anomaly (DEVIATIONS #56)
    Route::post('/invoices/{id}/credit-notes', [CreditNoteController::class, 'store'])->middleware('perm:billing.adjust');
    Route::post('/credit-notes/{id}/approve', [CreditNoteController::class, 'decide'])->defaults('decision', 'approved')->middleware('perm:billing.approve_reversal');
    Route::post('/credit-notes/{id}/reject', [CreditNoteController::class, 'decide'])->defaults('decision', 'rejected')->middleware('perm:billing.approve_reversal');
    Route::post('/invoices/{id}/void', [CreditNoteController::class, 'void'])->middleware('perm:billing.adjust');
    Route::post('/invoice-voids/{id}/approve', [CreditNoteController::class, 'decideVoid'])->defaults('decision', 'approved')->middleware('perm:billing.approve_reversal');
    Route::post('/invoice-voids/{id}/reject', [CreditNoteController::class, 'decideVoid'])->defaults('decision', 'rejected')->middleware('perm:billing.approve_reversal');
    Route::get('/billing/reversals/pending', [CreditNoteController::class, 'pending'])->middleware('perm:billing.approve_reversal');
    Route::post('/invoices/{id}/lines/from-correction/{correctionId}', [CreditNoteController::class, 'lineFromCorrection'])->middleware('perm:billing.adjust');
    Route::post('/line-corrections/{id}/review', [CreditNoteController::class, 'review'])->middleware('perm:billing.adjust');
    Route::post('/invoice-lines/{id}/approve-zero-tariff', [CreditNoteController::class, 'approveZeroTariff'])->middleware('perm:billing.approve_zero');
    // unit C koreksi: refund to the original payment's clinic account, allocated to a credit note, owner approval (DEVIATIONS #57)
    Route::post('/invoices/{id}/refunds', [RefundController::class, 'store'])->middleware('perm:billing.adjust');
    Route::post('/refunds/{id}/approve', [RefundController::class, 'decide'])->defaults('decision', 'approved')->middleware('perm:billing.approve_reversal');
    Route::post('/refunds/{id}/reject', [RefundController::class, 'decide'])->defaults('decision', 'rejected')->middleware('perm:billing.approve_reversal');
    // KL06: cashier shift in the active branch; the cashier closes alone, a difference needs a reason (DEVIATIONS #73)
    Route::get('/cash-shift/current', [CashShiftController::class, 'current'])->middleware('perm:billing.adjust');
    Route::post('/cash-shift', [CashShiftController::class, 'store'])->middleware('perm:billing.adjust');
    Route::post('/cash-shift/{id}/close', [CashShiftController::class, 'close'])->middleware('perm:billing.adjust');
});
