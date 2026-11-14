<?php

namespace App\Modules\Patients\Services;

use App\Modules\Patients\Contracts\PatientCareState;
use App\Modules\Patients\Domain\CareFacts;
use App\Modules\Patients\Domain\CareStatus;
use App\Modules\Patients\Models\Patient;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

final class PatientCareStateService implements PatientCareState
{
    public function recordClinical(string $patientId, ?DateTimeInterface $lastVisitAt, ?string $lastDentistId, ?string $lastDentistName,
        bool $hasOpenVisit, bool $hasUnfinishedProcedure): void
    {
        $this->write($patientId, ['last_visit_at' => $lastVisitAt, 'last_dentist_id' => $lastDentistId, 'last_dentist_name' => $lastDentistName,
            'care_open_visit' => $hasOpenVisit, 'care_unfinished_procedure' => $hasUnfinishedProcedure]);
    }

    public function recordScheduling(string $patientId, ?DateTimeInterface $nextAppointmentAt, bool $hasUnscheduledPlan): void
    {
        $this->write($patientId, ['next_appointment_at' => $nextAppointmentAt, 'care_unscheduled_plan' => $hasUnscheduledPlan]);
    }

    /** Recompute from stored facts (time moves: upcoming appointments pass, visits age). Returns the number of changed rows. */
    public function refreshAll(): int
    {
        $n = 0;
        Patient::query()->chunkById(500, function ($rows) use (&$n) {
            foreach ($rows as $p) {
                $n += (int) self::apply($p);
            }
        });

        return $n;
    }

    /** Read-modify-write under a row lock so two writers never lose each other's facts. */
    private function write(string $patientId, array $facts): void
    {
        DB::transaction(function () use ($patientId, $facts) {
            self::apply(Patient::lockForUpdate()->findOrFail($patientId)->fill($facts));
        });
    }

    private static function apply(Patient $p): bool
    {
        $p->care_status = CareStatus::of(new CareFacts($p->status, $p->care_open_visit, $p->next_appointment_at,
            $p->care_unfinished_procedure, $p->care_unscheduled_plan, $p->last_visit_at), now());

        return $p->isDirty() && $p->save();
    }
}
