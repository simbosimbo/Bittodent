<?php

namespace App\Modules\Tariffs\Contracts;

// Who performed the procedure, as Billing knows it from Clinical\Events\ProcedureRecorded (Tariffs never reads Tenancy/Identity).
final class PriceContext
{
    public function __construct(
        public readonly string $dentistId,
        public readonly string $category, // general | specialist
        public readonly ?string $field,   // App\Shared\Dentist\Specialty::FIELDS key, specialists only
    ) {}
}
