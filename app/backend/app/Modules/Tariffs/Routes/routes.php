<?php

use App\Modules\Tariffs\Http\Controllers\TariffController;
use App\Modules\Tariffs\Http\Controllers\TariffRuleController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::get('/tariffs', [TariffController::class, 'index'])->middleware('perm:tariff.manage');
    Route::get('/tariffs/rules', [TariffRuleController::class, 'index'])->middleware('perm:tariff.manage');
    Route::put('/tariffs/rules', [TariffRuleController::class, 'put'])->middleware('perm:tariff.manage');
    Route::post('/tariffs/bulk', [TariffController::class, 'bulk'])->middleware('perm:tariff.manage');
    Route::put('/tariffs/category', [TariffController::class, 'category'])->middleware('perm:tariff.manage');
    Route::put('/tariffs/rates', [TariffController::class, 'rate'])->middleware('perm:tariff.manage');
    Route::put('/tariffs/{id}/levels', [TariffController::class, 'levels'])->middleware('perm:tariff.manage');
});
