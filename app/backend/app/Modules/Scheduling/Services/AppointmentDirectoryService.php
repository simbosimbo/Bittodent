<?php

namespace App\Modules\Scheduling\Services;

use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Scheduling\Models\Appointment;

final class AppointmentDirectoryService implements AppointmentDirectory
{
    public function findOrFail(string $appointmentId): array
    {
        return Appointment::findOrFail($appointmentId)->only(['id', 'patient_id', 'branch_id', 'dentist_id', 'status']);
    }

    public function bookedStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to): array
    {
        return Appointment::where('status', 'booked')->where('starts_at', '>=', $from)->where('starts_at', '<', $to)
            ->orderBy('starts_at')->get(['tenant_id', 'id', 'starts_at'])->map(fn ($a) => ['id' => $a->id, 'starts_at' => $a->starts_at])->all();
    }
}
