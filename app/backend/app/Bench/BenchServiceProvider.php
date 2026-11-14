<?php

namespace App\Bench;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

// Loaded always; routes and the query-count header exist only when ehr.bench_endpoints is true (local bench).
class BenchServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (! config('ehr.bench_endpoints') || $this->app->isProduction()) {
            return;
        }
        if (! $this->app->routesAreCached()) {
            Route::prefix('api/bench')->middleware(['api', 'auth:sanctum', '2fa', 'tenant'])->group(function () {
                Route::get('/invoices', [Http\BenchController::class, 'invoices'])->middleware('perm:billing.read');
                Route::get('/audit', [Http\BenchController::class, 'audit'])->middleware('perm:patient.read');
                Route::post('/images', [Http\BenchController::class, 'upload'])->middleware('perm:note.write');
                Route::get('/images/{id}', [Http\BenchController::class, 'view'])->middleware('perm:note.read');
                Route::get('/images/{id}/thumb', [Http\BenchController::class, 'thumb'])->middleware('perm:note.read');
            });
        }
        $this->app['router']->pushMiddlewareToGroup('api', Http\CountQueries::class);
    }
}
