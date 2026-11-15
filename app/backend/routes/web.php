<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

// Infra routes, loaded from bootstrap/app.php WITHOUT a middleware group (no session row per probe/page load).
// Module API routes live in app/Modules/*/Routes/routes.php. GET /up (liveness) is Laravel's built-in health route.

// Readiness: can the runtime account reach the database? No schema, host or error text in the response.
Route::get('/ready', function () {
    try {
        DB::select('select 1');
    } catch (Throwable) {
        Log::warning('readiness_db_unavailable');

        return response()->json(['status' => 'unavailable'], 503);
    }

    return response()->json(['status' => 'ok']);
});

// Built SPA (app/scripts/build-spa-into-backend.sh -> public/client) served from the API host, so the Sanctum
// session + XSRF cookies stay first-party (same as the nginx / Vite proxy). Hash routes (#/pasien) need only "/".
Route::get('/', function () {
    $index = public_path('client/index.html');
    abort_unless(is_file($index), 404);

    return response()->file($index, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache']);
});
