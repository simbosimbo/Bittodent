<?php

namespace App\Modules\Patients\Contracts;

use DateTimeInterface;

// Other modules PUSH care facts into Patients (Patients never reads visit/appointment/users). Each writer sends the full
// snapshot of ITS OWN facts; the other writer's facts on the patient are kept. care_status is recomputed on every write.
// Both methods: 404 (ModelNotFoundException) when the patient is not in the current tenant. Call inside or outside a transaction.
interface PatientCareState
{
    /** Clinical: latest visit (ended_at when selesai, else started_at) + its dentist, open visit, unfinished final procedure. */
    public function recordClinical(string $patientId, ?DateTimeInterface $lastVisitAt, ?string $lastDentistId, ?string $lastDentistName,
        bool $hasOpenVisit, bool $hasUnfinishedProcedure): void;

    /** Scheduling: earliest appointment from today (Asia/Jakarta) that is not cancelled/no_show (null = none) + unscheduled plan. */
    public function recordScheduling(string $patientId, ?DateTimeInterface $nextAppointmentAt, bool $hasUnscheduledPlan): void;
}
