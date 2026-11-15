<?php

namespace App\Modules\Patients\Contracts;

// Read side of the medical history (the existing MedicalAlerts contract is write-only, for Intake). Consumer: ClinicalSummary.
interface MedicalHistoryReader
{
    /**
     * Latest version, decrypted. The urgent note text is NOT returned (only whether one exists). 404 when not in this tenant.
     *
     * @return array{id: string, version: int, allergies: list<string>, medications: list<string>, problems: list<string>, premedication_required: bool, has_urgent_note: bool, created_at: \DateTimeInterface}|null
     */
    public function current(string $patientId): ?array;
}
