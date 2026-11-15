<?php

namespace App\Modules\IcdSuggestions\Domain;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\MatchKind;

// Draft payload of one agent_draft (kind saran_icd, target = visit). code/display/version always come from the dictionary.
final readonly class IcdSuggestion
{
    /** @param list<array{ref: string, type: string, id: string, version?: int, tooth?: int, surface?: ?string}> $citations */
    public function __construct(
        public IcdSystem $system,
        public string $code,
        public string $display,
        public string $version,
        public string $reason,
        public array $citations,
        public SuggestionSource $source,
        public int $rank,
        public MatchKind $why,
        public bool $perluDicek = true,
    ) {}

    public function key(): string
    {
        return $this->system->value.':'.$this->code;
    }

    public function payload(string $visitId): array
    {
        return ['visit_id' => $visitId, 'key' => $this->key(), 'system' => $this->system->value, 'code' => $this->code, 'display' => $this->display,
            'version' => $this->version, 'reason' => $this->reason, 'citations' => $this->citations, 'source' => $this->source->value,
            'rank' => $this->rank, 'why' => $this->why->value, 'perlu_dicek' => $this->perluDicek];
    }
}
