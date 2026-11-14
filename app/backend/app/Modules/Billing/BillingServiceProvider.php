<?php

namespace App\Modules\Billing;

use App\Modules\Billing\Listeners\InvoiceFromProcedure;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Shared\ModuleServiceProvider;
use Illuminate\Support\Facades\Event;

class BillingServiceProvider extends ModuleServiceProvider
{
    public function boot(): void
    {
        parent::boot();
        Event::listen(ProcedureRecorded::class, [InvoiceFromProcedure::class, 'handle']);
    }
}
