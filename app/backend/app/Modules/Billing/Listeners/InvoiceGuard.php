<?php

namespace App\Modules\Billing\Listeners;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Events\VisitClosing;
use App\Shared\Tenancy\Ctx;
use LogicException;

// Unit 4: a visit with completed work closes only when each completed procedure has a line on this visit's invoice.
final class InvoiceGuard
{
    public function handle(VisitClosing $e): void
    {
        if ($e->tenantId !== Ctx::current()->tenant()) {
            throw new LogicException('VisitClosing dari tenant lain.');
        }
        if ($e->completedProcedureIds === []) {
            return;
        }
        $billed = InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $e->visitId)->select('id'))
            ->whereIn('procedure_id', $e->completedProcedureIds)->pluck('procedure_id')->all();
        $e->block(array_values(array_diff($e->completedProcedureIds, $billed)));
    }
}
