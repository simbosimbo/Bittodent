<?php

namespace App\Modules\Scheduling;

use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Scheduling\Services\AppointmentDirectoryService;
use App\Shared\ModuleServiceProvider;

class SchedulingServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [AppointmentDirectory::class => AppointmentDirectoryService::class];
}
