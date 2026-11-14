<?php

use App\Modules\Tariffs\Http\Controllers\TariffController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    Route::put('/tariffs/{id}/levels', [TariffController::class, 'levels'])->middleware('perm:tariff.manage');
});
