<?php

namespace App\Modules\Billing;

use App\Modules\Billing\Contracts\IntegrityFacts;
use App\Modules\Billing\Listeners\CreditFromCorrection;
use App\Modules\Billing\Listeners\InvoiceFromProcedure;
use App\Modules\Billing\Listeners\InvoiceGuard;
use App\Modules\Billing\Services\IntegrityFactsService;
use App\Modules\Clinical\Events\ProcedureCorrected;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Clinical\Events\VisitClosing;
use App\Shared\ModuleServiceProvider;
use Illuminate\Support\Facades\Event;

class BillingServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [IntegrityFacts::class => IntegrityFactsService::class];

    public function boot(): void
    {
        parent::boot();
        Event::listen(ProcedureRecorded::class, [InvoiceFromProcedure::class, 'handle']);
        Event::listen(VisitClosing::class, [InvoiceGuard::class, 'handle']);
        Event::listen(ProcedureCorrected::class, [CreditFromCorrection::class, 'handle']);
    }
}
