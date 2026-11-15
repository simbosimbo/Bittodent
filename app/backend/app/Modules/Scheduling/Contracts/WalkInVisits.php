<?php

namespace App\Modules\Scheduling\Contracts;

use Carbon\CarbonImmutable;

// Port implemented by Clinical (which owns visits); Scheduling may not depend on Clinical (Clinical -> Scheduling already).
interface WalkInVisits
{
    /** @return list<string> distinct patient ids with a visit without appointment started in [$from, $to) at this branch */
    public function patientIds(string $branchId, CarbonImmutable $from, CarbonImmutable $to): array;
}
