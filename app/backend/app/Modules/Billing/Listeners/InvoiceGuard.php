<?php

namespace App\Modules\Billing\Listeners;

use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoiceVoid;
use App\Modules\Billing\Services\Ledger;
use App\Modules\Clinical\Events\VisitClosing;
use App\Shared\Tenancy\Ctx;
use LogicException;

// Unit 4: a visit with completed work closes only when each completed procedure has a line on this visit's invoice.
// Unit B: a line covered by an applied credit note / approved void stays "handled" (the line exists). A pending reversal (full credit
// note or void waiting for an owner) is NOT handled: its procedures block the close until the owner decides.
final class InvoiceGuard
{
    public function handle(VisitClosing $e): void
    {
        if ($e->tenantId !== Ctx::current()->tenant()) {
            throw new LogicException('VisitClosing dari tenant lain.');
        }
        $invoice = Invoice::where('visit_id', $e->visitId)->select('id');
        $billed = InvoiceLine::whereIn('invoice_id', $invoice)->whereIn('procedure_id', $e->completedProcedureIds)->pluck('procedure_id')->all();
        $e->block(array_values(array_diff($e->completedProcedureIds, $billed)));
        $pendingLines = Ledger::pending(CreditNote::whereIn('invoice_id', $invoice), 'credit_note_id')->select('invoice_line_id');
        $pendingVoid = Ledger::pending(InvoiceVoid::whereIn('invoice_id', $invoice), 'invoice_void_id')->select('invoice_id');
        $e->block(InvoiceLine::where(fn ($q) => $q->whereIn('id', $pendingLines)->orWhereIn('invoice_id', $pendingVoid))->pluck('procedure_id')->all());
    }
}
