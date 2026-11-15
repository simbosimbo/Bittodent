<?php

namespace App\Modules\Billing\Listeners;

use App\Modules\Billing\Http\Controllers\CreditNoteController;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\LineCorrection;
use App\Modules\Billing\Services\Ledger;
use App\Modules\Clinical\Events\ProcedureCorrected;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use LogicException;

// Unit B (DEVIATIONS #54). Sync, inside Clinical's correction transaction. Never creates an invoice line, never a discount:
// - tidak_dikerjakan: each billed line of the chain gets a PENDING full credit note (owner, billing.approve_reversal), linked to the correction.
// - salah_kode/situs/provider: no money moves; the line is flagged "perlu tinjau koreksi" for the cashier (credit note, bill the
//   corrected code, or mark reviewed).
final class CreditFromCorrection
{
    public function handle(ProcedureCorrected $e): void
    {
        if ($e->tenantId !== Ctx::current()->tenant()) {
            throw new LogicException('ProcedureCorrected dari tenant lain.');
        }
        $lines = InvoiceLine::whereIn('procedure_id', [...$e->chainProcedureIds, $e->oldProcedureId])->orderBy('created_at')->get();
        foreach ($lines as $line) {
            $inv = Invoice::lockForUpdate()->findOrFail($line->invoice_id);
            if ($inv->status === 'void') {
                continue; // owes nothing already
            }
            if ($e->reasonType === 'tidak_dikerjakan') {
                if (Ledger::creditable($line) > 0) {
                    CreditNoteController::issue($inv, $line, Ledger::creditable($line), 'tidak_dikerjakan',
                        'Koreksi klinis: tindakan tidak dikerjakan.', $e->correctionId);
                }

                continue;
            }
            $r = LineCorrection::create(['invoice_id' => $inv->id, 'invoice_line_id' => $line->id, 'procedure_correction_id' => $e->correctionId,
                'reason_type' => $e->reasonType, 'new_procedure_id' => $e->newProcedureId, 'billable' => $e->newBilling ? [
                    'procedure_code' => $e->newBilling->procedureCode, 'variant' => $e->newBilling->variant, 'tooth' => $e->newBilling->tooth,
                    'surfaces' => $e->newBilling->surfaces, 'dentist_id' => $e->newBilling->dentistId,
                    'dentist_category' => $e->newBilling->dentistCategory, 'dentist_field' => $e->newBilling->dentistField] : null]);
            Audit::log('koreksi_tagihan.perlu_tinjau', 'invoice', $inv->id, ['line_correction_id' => $r->id, 'invoice_line_id' => $line->id,
                'procedure_correction_id' => $e->correctionId, 'reason_type' => $e->reasonType]);
        }
    }
}
