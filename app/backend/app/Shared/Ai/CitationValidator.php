<?php

namespace App\Shared\Ai;

// Generic server-side guard for model output that cites its sources (summary, scribe spans, ICD suggestions).
// A claim is kept only if it is well-formed and EVERY ref points to a source that was really in the model input
// (the manifest the feature built). Anything else is dropped, never repaired. Pure: no I/O, no logging of text.
final class CitationValidator
{
    public const MALFORMED = 'malformed';

    public const CITATION_MISSING = 'citation_missing';

    public const CITATION_UNKNOWN = 'citation_unknown';

    public const CITATION_WRONG_TYPE = 'citation_wrong_type';

    /**
     * @param  list<mixed>  $claims  untrusted, each expected as ['text' => string, 'refs' => list<string>, 'section' => ?string]
     * @param  array<string, string>  $sources  manifest: ref => source type (e.g. 'N1' => 'note_version')
     * @param  array<string, list<string>>  $allowedTypes  optional: section => source types it may cite
     */
    public static function validate(array $claims, array $sources, array $allowedTypes = []): CitationResult
    {
        $kept = [];
        $dropped = [];
        foreach (array_values($claims) as $i => $claim) {
            $reason = self::reasonToDrop($claim, $sources, $allowedTypes);
            if ($reason === null) {
                $kept[] = ['text' => $claim['text'], 'refs' => array_values(array_unique($claim['refs'])), 'section' => $claim['section'] ?? null];
            } else {
                $dropped[] = ['index' => $i, 'reason' => $reason];
            }
        }

        return new CitationResult($kept, $dropped);
    }

    private static function reasonToDrop(mixed $claim, array $sources, array $allowedTypes): ?string
    {
        if (! is_array($claim) || ! is_string($claim['text'] ?? null) || trim($claim['text']) === ''
            || (isset($claim['section']) && ! is_string($claim['section']))) {
            return self::MALFORMED;
        }
        $refs = $claim['refs'] ?? null;
        if (! is_array($refs) || $refs === []) {
            return self::CITATION_MISSING;
        }
        foreach ($refs as $ref) {
            if (! is_string($ref) || ! array_key_exists($ref, $sources)) {
                return self::CITATION_UNKNOWN;
            }
        }
        $section = $claim['section'] ?? null;
        if ($section !== null && array_key_exists($section, $allowedTypes)) {
            foreach ($refs as $ref) {
                if (! in_array($sources[$ref], $allowedTypes[$section], true)) {
                    return self::CITATION_WRONG_TYPE;
                }
            }
        }

        return null;
    }
}
