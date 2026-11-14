<?php

namespace App\Shared;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

// Base for app/Modules/<Name>/<Name>ServiceProvider: loads the module's Routes/routes.php under /api (api middleware group).
// Modules are registered from config/modules.php (AppServiceProvider).
abstract class ModuleServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> Contracts\X => implementation */
    public array $bindings = [];

    public function boot(): void
    {
        $routes = dirname((new \ReflectionClass($this))->getFileName()).'/Routes/routes.php';
        if (is_file($routes) && ! $this->app->routesAreCached()) {
            Route::prefix('api')->middleware('api')->group($routes);
        }
    }
}
