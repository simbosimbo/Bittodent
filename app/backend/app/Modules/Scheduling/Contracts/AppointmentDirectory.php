<?php

namespace App\Modules\Scheduling\Contracts;

interface AppointmentDirectory
{
    /** @return array{id: string, patient_id: string, branch_id: string, dentist_id: string, status: string} 404 when not in this tenant */
    public function findOrFail(string $appointmentId): array;

    /** Booked appointments starting in [from, to) (UTC), current tenant. @return list<array{id: string, starts_at: \DateTimeInterface}> */
    public function bookedStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to): array;
}
