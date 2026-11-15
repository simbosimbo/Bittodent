<?php

namespace App\Modules\Clinical\Events;

// Dispatched inside the transaction that applies a procedure correction (within window, or owner approval). NOT a billing trigger:
// a correction never creates an invoice_line by itself. Billing (unit B, Listeners\CreditFromCorrection) turns it into a pending
// credit note (tidak_dikerjakan) or a "perlu tinjau" flag on the billed line (salah_*). Carries ids, reason_type and the structured
// billing fields of the new row (no reason text, no price).
final class ProcedureCorrected
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $correctionId,
        public readonly string $oldProcedureId,
        public readonly string $newProcedureId,
        public readonly string $reasonType, // salah_kode | salah_situs | salah_provider | tidak_dikerjakan
        /** @var list<string> earlier rows of the correction chain, root first (the billed line sits on one of them) */
        public readonly array $chainProcedureIds = [],
        // what normal billing would send for the new row (selesai with a code), for the cashier's "Tagih kode yang benar"; never dispatched
        public readonly ?ProcedureRecorded $newBilling = null,
    ) {}
}
