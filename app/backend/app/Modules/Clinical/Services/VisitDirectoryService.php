<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Contracts\WalkInVisits;
use Carbon\CarbonImmutable;

final class VisitDirectoryService implements VisitDirectory, WalkInVisits
{
    public function findOrFail(string $visitId): array
    {
        return Visit::findOrFail($visitId)->only(['id', 'patient_id', 'branch_id', 'dentist_id']);
    }

    public function patientIds(string $branchId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return Visit::where('branch_id', $branchId)->whereNull('appointment_id')
            ->where('started_at', '>=', $from)->where('started_at', '<', $to)->distinct()->pluck('patient_id')->all();
    }
}
