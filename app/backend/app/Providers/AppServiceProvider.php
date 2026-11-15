<?php

namespace App\Providers;

use App\Shared\Tenancy\Ctx;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Reset per request/job. Under Octane this MUST stay scoped (never static/singleton) or tenants leak.
        $this->app->scoped(Ctx::class, fn () => new Ctx);

        foreach (array_keys(config('modules')) as $name) {
            $this->app->register("App\\Modules\\$name\\{$name}ServiceProvider");
        }
    }

    public function boot(): void
    {
        if ($proxies = config('ehr.trusted_proxies')) {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }
        URL::forceHttps(config('ehr.force_https'));

        Model::preventLazyLoading(! $this->app->isProduction()); // N+1 = exception in dev/test

        if (config('database.connections.'.config('database.default').'.driver') === 'mysql') {
            $this->loadMigrationsFrom(database_path('migrations/mysql'));
        }
    }
}
