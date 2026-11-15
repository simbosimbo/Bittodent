<?php

namespace App\Modules\ClinicalSummary\Services;

use App\Modules\Clinical\Contracts\ClinicalHistory;
use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Domain\SummarySources;
use App\Modules\Patients\Contracts\MedicalHistoryReader;
use App\Modules\Prescriptions\Contracts\PrescriptionHistory;

// Reads signed/final data through the read contracts only (never another module's models). 404 for another tenant's patient.
final class SourceCollector
{
    public function __construct(private ClinicalHistory $clinical, private MedicalHistoryReader $medical, private PrescriptionHistory $prescriptions) {}

    public function collect(string $patientId, HistoryScope $scope): SummarySources
    {
        return new SummarySources(
            $this->clinical->signedHistory($patientId, $scope->months, $scope->maxVisits),
            $this->medical->current($patientId),
            $this->prescriptions->activeSigned($patientId, $scope->months),
            now()->toImmutable(),
        );
    }
}
