<?php

namespace App\Modules\Clinical\Events;

// Dispatched inside the signing/status transaction when a final procedure_record reaches `selesai` (the ONLY billing trigger); Billing listens and generates the
// invoice line with a price snapshot from Tariffs. Deliberately carries NO price: the dentist never SETS prices (D-045: the SPA shows a
// read-only preview from GET /api/tariffs/price-list; Clinical itself never reads Tariffs).
// Who + category/field travel with it so Billing picks the price band without depending on Tenancy.
final class ProcedureRecorded
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $visitId,
        public readonly string $procedureCode, // ICD-9-CM (2010) / clinic code
        public readonly string $variant,       // tingkat kesulitan, chosen clinically
        public readonly ?string $tooth,
        public readonly string $procedureId,   // source procedure_record: Billing bills each procedure once (unique invoice_line.procedure_id)
        public readonly string $dentistId,     // procedure provider (who performed it; default visit dentist)
        public readonly string $dentistCategory, // general | specialist (Tenancy dentist_profile of this tenant)
        public readonly ?string $dentistField, // specialist field code, null for general / no field
        public readonly ?string $surfaces,     // combination in canonical order, e.g. "MOD" (one act, one price)
    ) {}
}
