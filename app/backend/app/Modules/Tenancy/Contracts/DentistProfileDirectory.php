<?php

namespace App\Modules\Tenancy\Contracts;

// Implemented by Services\DentistProfileDirectoryService. Consumer: Clinical (puts the dentist's category/field on ProcedureRecorded;
// Billing reads it from the event, so neither Clinical nor Billing needs Tariffs <-> Tenancy edges).
interface DentistProfileDirectory
{
    /** @return array{category: string, field: ?string} of the CURRENT tenant; no profile = general, null */
    public function of(string $userId): array;
}
