<?php

namespace App\Shared\Ai;

final readonly class CitationResult
{
    /**
     * @param  list<array{text: string, refs: list<string>, section: ?string}>  $kept
     * @param  list<array{index: int, reason: string}>  $dropped  index into the original claim list; no text
     */
    public function __construct(public array $kept, public array $dropped) {}

    public function droppedRatio(): float
    {
        $total = count($this->kept) + count($this->dropped);

        return $total === 0 ? 0.0 : count($this->dropped) / $total;
    }
}
