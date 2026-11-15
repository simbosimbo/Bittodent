<?php

namespace App\Modules\ClinicalSummary\Domain;

// Points at one exact source record + version. Built on the server only (the model sees refs like N1, never ids).
final readonly class Citation
{
    public function __construct(
        public SourceType $type,
        public string $sourceId,
        public int $version,
        public ?string $visitId,
        public int $daysAgo,
    ) {}

    public function toArray(): array
    {
        return ['type' => $this->type->value, 'source_id' => $this->sourceId, 'version' => $this->version, 'visit_id' => $this->visitId, 'days_ago' => $this->daysAgo];
    }
}
