<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdCandidate;
use App\Modules\IcdSuggestions\Contracts\IcdSearch;
use App\Modules\IcdSuggestions\Contracts\MatchKind;
use App\Modules\IcdSuggestions\Models\IcdCode;
use App\Modules\IcdSuggestions\Models\IcdTerm;

// MySQL implementation (README "Urutan deterministik"). Score = strength * 1000 + detail (synonym length / display word overlap minus extra words);
// ties: more specific (longer) code, then code. A code that is not in icd_entry never comes back.
final class MysqlIcdSearch implements IcdSearch
{
    public const MAX = 40;

    /** @var list<array{0: string, 1: list<string>, 2: IcdSystem, 3: string}>|null term, its words, system, code */
    private ?array $terms = null;

    public function search(string $query, ?IcdSystem $system = null, int $limit = self::MAX): array
    {
        $limit = max(0, min($limit, self::MAX));
        $words = self::words($query);
        if ($words === [] || $limit === 0) {
            return [];
        }
        $hits = [];
        $hit = function (IcdSystem $s, string $code, MatchKind $why, int $detail, ?string $term) use (&$hits, $system) {
            $score = $why->strength() * 1000 + $detail;
            $key = $s->value.':'.$code;
            if (($system === null || $system === $s) && $score > ($hits[$key][0] ?? -1)) {
                $hits[$key] = [$score, $why, $term];
            }
        };
        foreach ($words as $w) {
            $code = strtoupper($w);
            foreach (IcdSystem::cases() as $s) {
                // ICD-9-CM only with a dot: a bare "23" or "36" is far more often a tooth number than a category.
                if ($s->validFormat($code) && ($s === IcdSystem::Icd10 || str_contains($code, '.'))) {
                    $hit($s, $code, MatchKind::ExactCode, 0, null);
                }
            }
        }
        foreach ($this->terms() as [$term, $termWords, $s, $code]) {
            $why = self::termMatch($termWords, $words);
            if ($why !== null) {
                $hit($s, $code, $why, mb_strlen($term), $term);
            }
        }
        $text = implode(' ', array_filter($words, fn ($w) => ! str_contains($w, '.')));
        if ($text !== '') {
            $rows = IcdCode::whereFullText('display', $text)->when($system, fn ($q) => $q->where('system', $system))
                ->orderBy('system')->orderBy('code')->limit(self::MAX)->get();
            foreach ($rows as $r) {
                $display = array_unique(self::words($r->display));
                $overlap = count(array_intersect($display, $words));
                if ($overlap > 0) { // more query words first, then fewer extra display words (closest title)
                    $hit($r->system, $r->code, MatchKind::Fulltext, min(9, $overlap) * 100 - min(99, count($display) - $overlap), null);
                }
            }
        }

        $entries = $hits === [] ? collect() : IcdCode::whereIn('code', array_map(fn ($k) => explode(':', $k, 2)[1], array_keys($hits)))->get()
            ->keyBy(fn (IcdCode $c) => $c->system->value.':'.$c->code);
        $out = [];
        foreach ($hits as $key => [$score, $why, $term]) {
            if ($e = $entries->get($key)) {
                $out[] = new IcdCandidate($e->toEntry(), $score, $why, $term);
            }
        }
        usort($out, fn (IcdCandidate $a, IcdCandidate $b) => [$b->score, strlen($b->entry->code), $a->entry->system->value, $a->entry->code]
            <=> [$a->score, strlen($a->entry->code), $b->entry->system->value, $b->entry->code]);

        return array_slice($out, 0, $limit);
    }

    /** Lowercase words; dots kept inside codes (K02.1, 23.09). @return list<string> */
    public static function words(string $text): array
    {
        $parts = preg_split('/[^\p{L}\p{N}.]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_filter(array_map(fn ($w) => trim($w, '.'), $parts), fn ($w) => $w !== ''));
    }

    /** Every synonym word must be in the query (any order); words of 5+ letters may differ by one edit. */
    private static function termMatch(array $termWords, array $words): ?MatchKind
    {
        $typo = false;
        foreach ($termWords as $tw) {
            if (in_array($tw, $words, true)) {
                continue;
            }
            $near = strlen($tw) >= 5 && array_filter($words, fn ($w) => strlen($w) >= 5 && levenshtein($tw, $w) <= 1) !== [];
            if (! $near) {
                return null;
            }
            $typo = true;
        }

        return $typo ? MatchKind::SynonymTypo : MatchKind::Synonym;
    }

    private function terms(): array
    {
        // shortcut: all synonyms are loaded once per instance (sample list, ~90 rows); move to a FULLTEXT/trigram prefilter
        // when the list reaches thousands.
        return $this->terms ??= IcdTerm::orderBy('id')->get()
            ->map(fn (IcdTerm $t) => [$t->term, self::words($t->term), $t->system, $t->code])->all();
    }
}
