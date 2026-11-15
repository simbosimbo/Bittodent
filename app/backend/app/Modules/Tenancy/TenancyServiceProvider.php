<?php

namespace App\Modules\Tenancy;

use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Modules\Tenancy\Services\DentistProfileDirectoryService;
use App\Modules\Tenancy\Services\TenancyDirectoryService;
use App\Shared\ModuleServiceProvider;

class TenancyServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [TenancyDirectory::class => TenancyDirectoryService::class, DentistProfileDirectory::class => DentistProfileDirectoryService::class];
}
