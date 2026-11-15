<?php

namespace App\Modules\Clinical\Contracts;

// One planned procedure on one tooth. surfaces = [] for a whole-tooth item. condition = the odontogram condition it treats.
final class PlannedTreatment
{
    /** @param list<string> $surfaces */
    public function __construct(
        public readonly int $tooth,
        public readonly array $surfaces,
        public readonly string $condition,
        public readonly string $procedureCode,
    ) {}
}
