<?php

namespace App\Modules\Clinical;

use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Clinical\Services\VisitDirectoryService;
use App\Shared\ModuleServiceProvider;

class ClinicalServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [VisitDirectory::class => VisitDirectoryService::class];
}
