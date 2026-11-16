<?php

namespace App\Modules\Patients\Domain;

use DateTimeInterface;

// Input of CareStatus: facts pushed by Clinical/Scheduling and stored on `patient` (never live queries to other modules).
final class CareFacts
{
    public function __construct(
        public readonly string $adminStatus = 'aktif',
        public readonly bool $hasOpenVisit = false,
        public readonly ?DateTimeInterface $nextAppointmentAt = null,
        public readonly bool $hasUnfinishedProcedure = false,
        public readonly bool $hasUnscheduledPlan = false,
        public readonly ?DateTimeInterface $lastVisitAt = null,
    ) {}
}
