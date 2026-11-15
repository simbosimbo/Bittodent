<?php

namespace App\Modules\ClinicalSummary\Domain;

// Pseudonymised model input. $json is the ONLY thing sent to the model. $refs (ref => real source) stays on the server.
final readonly class ModelInput
{
    /**
     * @param  array<string, array{citation: Citation, fields: array}>  $refs  N1/F2 => real record (+ the scrubbed fields that were sent)
     */
    public function __construct(
        public string $json,
        public array $refs,
        public int $redactions,
    ) {}

    /** @return array<string, string> ref => source type, for App\Shared\Ai\CitationValidator */
    public function manifest(): array
    {
        return array_map(fn ($r) => $r['citation']->type->value, $this->refs);
    }
}
