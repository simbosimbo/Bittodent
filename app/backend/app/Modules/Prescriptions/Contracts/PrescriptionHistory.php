<?php

namespace App\Modules\Prescriptions\Contracts;

// Read-only. Consumer: ClinicalSummary (medicines that were prescribed, as KFA codes).
interface PrescriptionHistory
{
    /**
     * Signed prescriptions of the patient in the last $months that have no void, newest first. Codes only (no dosage text).
     *
     * @return list<array{id: string, visit_id: string, signed_at: \DateTimeInterface, kfa_codes: list<string>}>
     */
    public function activeSigned(string $patientId, int $months): array;
}
