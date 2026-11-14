<?php

use App\Modules\Billing\Http\Controllers\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/billing/daily-revenue', [InvoiceController::class, 'dailyRevenue'])->middleware('perm:billing.read');
    Route::get('/visits/{id}/invoice', [InvoiceController::class, 'forVisit'])->middleware('perm:billing.read');
    Route::get('/invoices/{id}', [InvoiceController::class, 'show'])->middleware('perm:billing.read');
    Route::post('/invoices/{id}/adjustments', [InvoiceController::class, 'adjust'])->middleware('perm:billing.adjust');
});
