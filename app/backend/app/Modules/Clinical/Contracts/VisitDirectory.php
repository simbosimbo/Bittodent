<?php

namespace App\Modules\Clinical\Contracts;

// Implemented by Services\VisitDirectoryService (C3; used by Billing). Consumer: Prescriptions (a prescription belongs to a visit + its dentist).
interface VisitDirectory
{
    /** @return array{id: string, patient_id: string, branch_id: string, dentist_id: string} 404 when not in this tenant */
    public function findOrFail(string $visitId): array;
}
