<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientCareState;

// Pushes Clinical's care facts for one patient into Patients (patient list: last visit, dentist, care status). Full snapshot
// of Clinical's own facts, so safe to run twice. Call after a visit starts/ends or a final procedure status changes.
final class PatientCareSync
{
    public function __construct(private PatientCareState $care, private UserDirectory $users) {}

    public function push(string $patientId): void
    {
        $last = Visit::where('patient_id', $patientId)->orderByDesc('started_at')->orderByDesc('id')->first(['tenant_id', 'id', 'dentist_id', 'started_at', 'ended_at', 'status']);
        $superseded = ToothFinding::where('patient_id', $patientId)->whereNotNull('supersedes_id')->select('supersedes_id');
        $unfinished = ToothFinding::where('patient_id', $patientId)->where('state', 'final')->whereIn('status', ProcedureStatus::IN_COURSE)
            ->whereNotIn('id', $superseded)->exists();
        $this->care->recordClinical($patientId,
            $last ? ($last->status === 'selesai' && $last->ended_at ? $last->ended_at : $last->started_at) : null,
            $last?->dentist_id,
            $last ? ($this->users->namesByIds([$last->dentist_id])[0]['name'] ?? null) : null,
            Visit::where('patient_id', $patientId)->where('status', 'berlangsung')->exists(),
            $unfinished);
    }
}
