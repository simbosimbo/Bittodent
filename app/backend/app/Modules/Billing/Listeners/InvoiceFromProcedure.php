<?php

namespace App\Modules\Billing\Listeners;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Tariffs\Contracts\PriceContext;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use LogicException;
use RuntimeException;

// Sync listener (runs inside Clinical's signing/status transaction): one invoice per visit, one line per procedure,
// price = Tariffs snapshot at this moment for the procedure provider's band (per-dentist > field > Spesialis > Umum). No tariff => no line (never an invented price) + audit row for the front desk.
final class InvoiceFromProcedure
{
    public function __construct(private VisitDirectory $visits, private PatientDirectory $patients, private PriceLookup $prices) {}

    public function handle(ProcedureRecorded $e): void
    {
        if ($e->tenantId !== Ctx::current()->tenant()) {
            throw new LogicException('ProcedureRecorded dari tenant lain.');
        }
        $visit = $this->visits->findOrFail($e->visitId);
        $invoice = Invoice::where('visit_id', $visit['id'])->first() ?? Invoice::create([
            'visit_id' => $visit['id'], 'patient_id' => $visit['patient_id'], 'branch_id' => $visit['branch_id'],
            'payer_patient_id' => $this->patients->payerOf($visit['patient_id']), 'created_by' => Ctx::current()->userId ?? $visit['dentist_id'],
        ]);
        if (InvoiceLine::where('procedure_id', $e->procedureId)->exists()) {
            return; // idempotent: the same procedure is billed once
        }
        try {
            $quote = $this->prices->quote($e->procedureCode, $e->variant, now(), new PriceContext($e->dentistId, $e->dentistCategory, $e->dentistField));
        } catch (RuntimeException) {
            Audit::log('tarif_tidak_ada', 'invoice', $invoice->id, ['procedure_code' => $e->procedureCode, 'variant' => $e->variant]);

            return;
        }
        InvoiceLine::create(['invoice_id' => $invoice->id, 'procedure_id' => $e->procedureId, 'procedure_code' => $e->procedureCode,
            'procedure_name' => $quote['name'], 'variant' => $e->variant, 'tooth' => $e->tooth === null || $e->tooth === '' ? null : (int) $e->tooth,
            'surface' => $e->surfaces, 'doctor_id' => $e->dentistId, 'dentist_category' => $e->dentistCategory, 'dentist_field' => $e->dentistField,
            'price_rp' => $quote['price_rp']]);
    }
}
