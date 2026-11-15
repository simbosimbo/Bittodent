<?php

namespace App\Modules\IcdSuggestions\Domain;

use App\Modules\Clinical\Contracts\IcdSystem;

// One piece of input with a short ref the UI and the model cite: F1..Fn (signed finding), A (draft diagnosis text),
// P (draft plan text). $source = ids only, for citations and agent_run.input_refs. No patient identifiers.
final readonly class QuerySpan
{
    /**
     * @param  list<IcdSystem>  $systems  systems this span is searched in
     * @param  array{type: string, id: string, version?: int, tooth?: int, surface?: ?string}  $source
     */
    public function __construct(
        public string $ref,
        public string $text,
        public array $systems,
        public array $source,
    ) {}
}
