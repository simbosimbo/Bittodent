<?php

namespace App\Modules\Patients\Contracts;

// Stub (no implementation/binding yet). Consumer: Intake (anamnesis answers raise alerts, e.g. allergies).
interface MedicalAlerts
{
    /** Replace the alerts that came from one anamnesis version. Alert text is health data: encrypted, never logged. @param list<array{code: string, text: string}> $alerts */
    public function syncFromIntake(string $patientId, string $intakeVersionId, array $alerts): void;
}
