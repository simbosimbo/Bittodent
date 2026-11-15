<?php

namespace App\Modules\Clinical;

use App\Modules\Clinical\Contracts\IntegrityFacts;
use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Clinical\Listeners\CloseVisitOnAppointmentDone;
use App\Modules\Clinical\Services\IntegrityFactsService;
use App\Modules\Clinical\Services\VisitDirectoryService;
use App\Modules\Scheduling\Events\AppointmentCompleting;
use App\Shared\ModuleServiceProvider;
use Illuminate\Support\Facades\Event;

class ClinicalServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [VisitDirectory::class => VisitDirectoryService::class, IntegrityFacts::class => IntegrityFactsService::class];

    public function boot(): void
    {
        parent::boot();
        Event::listen(AppointmentCompleting::class, [CloseVisitOnAppointmentDone::class, 'handle']);
    }
}
