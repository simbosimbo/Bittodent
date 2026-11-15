<?php

namespace App\Modules\Tariffs\Contracts;

// Implemented by Services\ProcedureCatalogService (A2). Consumer: TreatmentSuggestions, to map odontogram rules only to procedures
// this clinic already has in its tariff list (no invented codes). Names only, NEVER prices: the dentist-facing suggestion
// path must not see money (same rule that keeps Clinical away from Tariffs).
interface ProcedureCatalog
{
    /** @param list<string> $codes @return array<string, string> code => name, only codes that have a tariff row in this tenant */
    public function names(array $codes): array;

    /** @return list<array{code: string, name: string}> every procedure code in this tenant's tariff list */
    public function all(): array;
}
