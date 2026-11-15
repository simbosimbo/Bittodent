<?php

namespace App\Modules\Scribe\Contracts;

final readonly class Transcript
{
    /** @param list<TranscriptSegment> $segments */
    public function __construct(
        public array $segments,
        public string $language = 'id',
    ) {}

    /** @return array<string, string> manifest for CitationValidator: 'T1' => 'transcript' */
    public function citationManifest(): array
    {
        $out = [];
        foreach ($this->segments as $s) {
            $out[$s->id] = 'transcript';
        }

        return $out;
    }
}
