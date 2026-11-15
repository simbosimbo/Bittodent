<?php

namespace App\Modules\IcdSuggestions\Domain;

use App\Modules\Clinical\Contracts\IcdSystem;

// Compact, de-identified input for one visit: signed findings + the open draft's A/P text. No patient id, name, NIK or UUIDs
// in the text. $coded = codes already on the draft SOAP (never suggested again).
final readonly class IcdQuery
{
    /**
     * @param  list<QuerySpan>  $spans
     * @param  array{icd10: list<string>, icd9cm: list<string>}  $coded
     */
    public function __construct(public array $spans, public array $coded = ['icd10' => [], 'icd9cm' => []]) {}

    public function isCoded(IcdSystem $system, string $code): bool
    {
        return in_array($code, $this->coded[$system->value] ?? [], true);
    }

    /** ref => source type, the manifest for App\Shared\Ai\CitationValidator. @return array<string, string> */
    public function manifest(): array
    {
        return array_column(array_map(fn (QuerySpan $s) => [$s->ref, $s->source['type']], $this->spans), 1, 0);
    }

    public function hash(): string
    {
        // Same text = same input, whatever the draft revision; codes on the draft are a filter, not an input.
        return hash('sha256', json_encode(array_map(fn (QuerySpan $s) => [$s->ref, $s->text, $s->source['type'] === 'finding' ? $s->source : $s->source['id']],
            $this->spans), JSON_THROW_ON_ERROR));
    }
}
