<?php

namespace App\Modules\Scheduling\Contracts;

interface AppointmentDirectory
{
    /** @return array{id: string, patient_id: string, branch_id: string, dentist_id: string, status: string} 404 when not in this tenant */
    public function findOrFail(string $appointmentId): array;

    /** Booked appointments starting in [from, to) (UTC), current tenant. @return list<array{id: string, starts_at: \DateTimeInterface}> */
    public function bookedStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to): array;

    /** Cancelled / no-show appointments starting in [from, to) (UTC), current tenant; $branchIds null = all (owner report, unit 6).
     * @return list<array{id: string, patient_id: string, dentist_id: string, status: string, starts_at: string}> */
    public function cancelledStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /**
     * The appointment follows its visit: walk booked -> checked_in -> in_treatment -> done up to $to ('in_treatment' | 'done'),
     * stamping and auditing each step. No-op when already there or past it, or off that path (pending, cancelled, no_show, rejected).
     * Never fires AppointmentCompleting: the caller is the visit side already.
     */
    public function advance(string $appointmentId, string $to): void;
}
