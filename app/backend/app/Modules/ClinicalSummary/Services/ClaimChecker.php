<?php

namespace App\Modules\ClinicalSummary\Services;

use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Domain\ModelInput;
use App\Modules\ClinicalSummary\Domain\SummaryClaim;
use App\Shared\Ai\CitationValidator;

// Server-side checks of the model reply (design 2.5). Anything that fails is dropped, never repaired:
// schema, citations (CitationValidator), codes/teeth not in the cited source (D-037: no invented diagnosis/code), instruction
// markers, identifiers in the output. Returns kept claims per section with refs mapped back to real ids (server only).
final class ClaimChecker
{
    public const SECTIONS = ['keluhan', 'diagnosis', 'tindakan'];

    private const ICD10 = '/\b[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?\b/';

    private const ICD9 = '/\b[0-9]{2}\.[0-9]{1,2}\b/';

    private const TOOTH = '/\b(?:gigi|elemen)\s+((?:1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5]))\b/iu';

    private const INJECTION = '/(abaikan|ignore|instruksi|instruction|system prompt|sebagai ai)/iu';

    public function __construct(private Pseudonymizer $scrubber) {}

    /** @return array{sections: array<string, list<SummaryClaim>>, total: int, dropped: int, reasons: array<string, int>} */
    public function check(string $raw, ModelInput $input): array
    {
        $reply = json_decode($raw, true);
        $claims = [];
        foreach ((is_array($reply) && is_array($reply['sections'] ?? null)) ? $reply['sections'] : [] as $sec) {
            $kind = is_array($sec) ? ($sec['kind'] ?? null) : null;
            foreach ((is_array($sec) && is_array($sec['claims'] ?? null)) ? $sec['claims'] : [] as $c) {
                $claims[] = is_array($c) && in_array($kind, self::SECTIONS, true) ? [...$c, 'section' => $kind] : 'bad';
            }
        }
        $types = array_fill_keys(self::SECTIONS, ['note_version', 'finding']);
        $res = CitationValidator::validate($claims, $input->manifest(), $types);
        $reasons = array_count_values(array_column($res->dropped, 'reason'));

        $out = array_fill_keys(self::SECTIONS, []);
        foreach ($res->kept as $c) {
            $reason = $this->reject($c['text'], $c['refs'], $input);
            if ($reason !== null) {
                $reasons[$reason] = ($reasons[$reason] ?? 0) + 1;

                continue;
            }
            $out[$c['section']][] = new SummaryClaim(trim($c['text']), array_map(fn ($r) => $input->refs[$r]['citation'], $c['refs']));
        }
        $total = count($claims);

        return ['sections' => $out, 'total' => $total, 'dropped' => array_sum($reasons), 'reasons' => $reasons];
    }

    private function reject(string $text, array $refs, ModelInput $input): ?string
    {
        if (mb_strlen($text) > 300) {
            return 'too_long';
        }
        if (preg_match(self::INJECTION, $text)) {
            return 'injection_marker';
        }
        if ($this->scrubber->scrub($text, [], new HistoryScope) !== trim(preg_replace('/\s+/u', ' ', $text))) {
            return 'pii_in_output';
        }
        $source = json_encode(array_map(fn ($r) => $input->refs[$r]['fields'], $refs), JSON_UNESCAPED_UNICODE);
        preg_match_all(self::ICD10, $text, $a);
        preg_match_all(self::ICD9, $text, $p);
        foreach ([...$a[0], ...$p[0]] as $code) {
            if (! str_contains($source, '"'.$code.'"')) {
                return 'code_not_in_source';
            }
        }
        preg_match_all(self::TOOTH, $text, $t);
        foreach ($t[1] as $tooth) {
            if (! preg_match('/(?<![0-9])'.$tooth.'(?![0-9])/', $source)) {
                return 'code_not_in_source';
            }
        }

        return null;
    }
}
