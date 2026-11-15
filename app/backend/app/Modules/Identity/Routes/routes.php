<?php

use App\Modules\Identity\Http\Controllers\SelesaiPinController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', '2fa', 'tenant'])->group(function () {
    // own Selesai PIN (DEVIATIONS #54); throttled + lockout in UserDirectory (a wrong current PIN counts as a failure)
    Route::put('/me/selesai-pin', [SelesaiPinController::class, 'update'])->middleware('throttle:5,1,selesai_pin');
});
