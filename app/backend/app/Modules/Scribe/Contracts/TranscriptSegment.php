<?php

namespace App\Modules\Scribe\Contracts;

final readonly class TranscriptSegment
{
    public function __construct(
        public string $id, // T1, T2, ...
        public string $text,
        public ?float $startSec = null,
        public ?float $endSec = null,
    ) {}
}
