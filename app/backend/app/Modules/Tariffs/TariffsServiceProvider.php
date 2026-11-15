<?php

namespace App\Modules\Tariffs;

use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Contracts\ProcedureCatalog;
use App\Modules\Tariffs\Services\PriceLookupService;
use App\Modules\Tariffs\Services\ProcedureCatalogService;
use App\Shared\ModuleServiceProvider;

class TariffsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [PriceLookup::class => PriceLookupService::class, ProcedureCatalog::class => ProcedureCatalogService::class];
}
