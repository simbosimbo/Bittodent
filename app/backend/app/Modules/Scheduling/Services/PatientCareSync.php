<?php

namespace App\Modules\Scheduling\Services;

use App\Modules\Patients\Contracts\PatientCareState;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\PlannedAppointment;
use Carbon\CarbonImmutable;

// Pushes Scheduling's care facts for one patient into Patients. Full snapshot of Scheduling's own facts (safe to run twice).
// Call after an appointment is created/rescheduled/transitioned or a planned appointment is created/scheduled.
final class PatientCareSync
{
    public function __construct(private PatientCareState $care) {}

    public function push(string $patientId): void
    {
        // shortcut: "today" in Asia/Jakarta for every branch; use the branch timezone once WITA/WIT branches exist.
        $today = CarbonImmutable::now('Asia/Jakarta')->startOfDay()->utc();
        $next = Appointment::where('patient_id', $patientId)->whereNotIn('status', ['cancelled', 'no_show', 'rejected'])
            ->where('starts_at', '>=', $today)->min('starts_at');
        $this->care->recordScheduling($patientId, $next ? CarbonImmutable::parse($next, 'UTC') : null,
            PlannedAppointment::where('patient_id', $patientId)->where('status', 'perlu_dijadwalkan')->exists());
    }
}
