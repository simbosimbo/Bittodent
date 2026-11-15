<?php

namespace App\Modules\Clinical\Events;

// Dispatched inside the transaction that applies a procedure correction (within window, or owner approval). NOT a billing trigger:
// a correction never creates an invoice_line. Billing will consume it (unit B: credit note / difference linked to the old line);
// in unit A nothing listens. Carries ids + reason_type only (no reason text, no price).
final class ProcedureCorrected
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $correctionId,
        public readonly string $oldProcedureId,
        public readonly string $newProcedureId,
        public readonly string $reasonType, // salah_kode | salah_situs | salah_provider | tidak_dikerjakan
    ) {}
}
