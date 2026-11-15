<?php

namespace App\Modules\Clinical\Events;

// Dispatched (C3) inside the signing/status transaction when a dentist records a procedure on a visit; Billing listens and generates the
// invoice line with a price snapshot from Tariffs. Deliberately carries NO price: the dentist never sees or sets prices.
// Who + category/field travel with it so Billing picks the price band without depending on Tenancy.
final class ProcedureRecorded
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $visitId,
        public readonly string $procedureCode, // ICD-9-CM (2010) / clinic code
        public readonly string $variant,       // tingkat kesulitan, chosen clinically
        public readonly ?string $tooth,
        public readonly string $findingId,     // source tooth_finding (C3): Billing bills each procedure once
        public readonly string $dentistId,     // visit dentist
        public readonly string $dentistCategory, // general | specialist (Tenancy dentist_profile of this tenant)
        public readonly ?string $dentistField, // specialist field code, null for general / no field
        public readonly ?string $surface,
    ) {}
}
