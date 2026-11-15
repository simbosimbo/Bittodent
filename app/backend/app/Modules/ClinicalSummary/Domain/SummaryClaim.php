<?php

namespace App\Modules\ClinicalSummary\Domain;

final readonly class SummaryClaim
{
    /** @param list<Citation> $citations at least one */
    public function __construct(
        public string $text,
        public array $citations,
        public ?string $flagReason = null, // shown with a warning icon (e.g. date mismatch); null = valid
    ) {}

    public function toArray(string $id): array
    {
        return ['id' => $id, 'text' => $this->text, 'status' => $this->flagReason === null ? 'valid' : 'ditandai', 'flag_reason' => $this->flagReason,
            'citations' => array_map(fn (Citation $c) => $c->toArray(), $this->citations)];
    }
}
