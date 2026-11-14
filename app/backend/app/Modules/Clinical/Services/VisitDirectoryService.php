<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Clinical\Models\Visit;

final class VisitDirectoryService implements VisitDirectory
{
    public function findOrFail(string $visitId): array
    {
        return Visit::findOrFail($visitId)->only(['id', 'patient_id', 'branch_id', 'dentist_id']);
    }
}
