<?php

namespace App\Modules\IcdSuggestions\Contracts;

final readonly class IcdCandidate
{
    /** @param int $score higher = better; comparable only within one search() result */
    public function __construct(
        public IcdEntry $entry,
        public int $score,
        public MatchKind $why,
        public ?string $matchedTerm = null,   // the synonym that hit, if any
    ) {}
}
