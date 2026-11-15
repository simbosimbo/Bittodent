<?php

namespace App\Modules\ClinicalSummary\Domain;

final readonly class SummarySection
{
    /** @param list<SummaryClaim> $claims */
    public function __construct(
        public SectionKind $kind,
        public Generator $generator,
        public array $claims,
    ) {}
}
