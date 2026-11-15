<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdEntry;
use App\Modules\IcdSuggestions\Contracts\IcdSearch;
use App\Modules\IcdSuggestions\Contracts\MatchKind;
use App\Modules\IcdSuggestions\Domain\IcdQuery;
use App\Modules\IcdSuggestions\Domain\IcdSuggestion;
use App\Modules\IcdSuggestions\Domain\QuerySpan;
use App\Modules\IcdSuggestions\Domain\SuggestionSource;

// Deterministic part (no model): visit context -> IcdQuery -> candidate pool -> top suggestions per system.
// Spans: F1..Fn = signed findings (condition -> ICD-10; a planned procedure_code -> ICD-9-CM), A = draft A.text (ICD-10),
// P = draft P.text (ICD-9-CM). Codes already on the draft are never suggested.
final class IcdEngine
{
    public const PER_SYSTEM = 3;

    /** Odontogram legend condition -> search text. Others (sehat, tambalan, mahkota, implan, perlu_dicabut) are not a diagnosis. */
    private const CONDITION_TEXT = ['karies' => 'karies', 'sisa_akar' => 'sisa akar', 'hilang' => 'gigi hilang'];

    public function __construct(private IcdSearch $search) {}

    /**
     * @param  list<array{id: string, version: int, tooth: int, surface: ?string, condition: string, status: string, procedure_code: ?string}>  $findings
     * @param  array{version_id: string, revision: int, A: array{codes: list<string>, text: string}, P: array{codes: list<string>, text: string}}|null  $draft
     */
    public function query(array $findings, ?array $draft): IcdQuery
    {
        $spans = [];
        foreach ($findings as $f) {
            $systems = [];
            $text = [];
            if (isset(self::CONDITION_TEXT[$f['condition']])) {
                $systems[] = IcdSystem::Icd10;
                $text[] = self::CONDITION_TEXT[$f['condition']];
            }
            if ($f['status'] === 'direncanakan' && $f['procedure_code']) {
                $systems[] = IcdSystem::Icd9cm;
                $text[] = $f['procedure_code'];
            }
            if ($systems !== []) {
                $spans[] = new QuerySpan('F'.(count($spans) + 1), implode(' ', $text), $systems,
                    ['type' => 'finding', 'id' => $f['id'], 'version' => $f['version'], 'tooth' => $f['tooth'], 'surface' => $f['surface']]);
            }
        }
        foreach ([['A', IcdSystem::Icd10], ['P', IcdSystem::Icd9cm]] as [$block, $system]) {
            if ($draft && trim($draft[$block]['text']) !== '') {
                $spans[] = new QuerySpan($block, $draft[$block]['text'], [$system], ['type' => 'note_draft', 'id' => $draft['version_id'], 'version' => $draft['revision']]);
            }
        }

        return new IcdQuery($spans, ['icd10' => $draft['A']['codes'] ?? [], 'icd9cm' => $draft['P']['codes'] ?? []]);
    }

    /**
     * Every candidate of every span merged by system+code (best score kept, refs united), minus codes already coded.
     * Order: score, number of citing spans, more specific code, code.
     *
     * @return list<array{entry: IcdEntry, score: int, why: MatchKind, term: ?string, refs: list<string>}>
     */
    public function pool(IcdQuery $q): array
    {
        $pool = [];
        foreach ($q->spans as $span) {
            foreach ($span->systems as $system) {
                foreach ($this->search->search($span->text, $system) as $c) {
                    if ($q->isCoded($system, $c->entry->code)) {
                        continue;
                    }
                    $key = $system->value.':'.$c->entry->code;
                    $p = $pool[$key] ?? ['entry' => $c->entry, 'score' => -1, 'why' => $c->why, 'term' => null, 'refs' => []];
                    if ($c->score > $p['score']) {
                        [$p['score'], $p['why'], $p['term']] = [$c->score, $c->why, $c->matchedTerm];
                    }
                    $p['refs'] = array_values(array_unique([...$p['refs'], $span->ref]));
                    $pool[$key] = $p;
                }
            }
        }
        $pool = array_values($pool);
        usort($pool, fn ($a, $b) => [$b['score'], count($b['refs']), strlen($b['entry']->code), $a['entry']->system->value, $a['entry']->code]
            <=> [$a['score'], count($a['refs']), strlen($a['entry']->code), $b['entry']->system->value, $b['entry']->code]);

        return $pool;
    }

    /** Free mode and fallback: the best PER_SYSTEM of the pool per system. @return list<IcdSuggestion> */
    public function deterministic(IcdQuery $q, array $pool): array
    {
        $out = [];
        $n = ['icd10' => 0, 'icd9cm' => 0];
        foreach ($pool as $p) {
            if (++$n[$p['entry']->system->value] <= self::PER_SYSTEM) {
                $out[] = $this->suggestion($q, $p, $p['refs'], SuggestionSource::Deterministik, $n[$p['entry']->system->value]);
            }
        }

        return $out;
    }

    /** @param list<string> $refs */
    public function suggestion(IcdQuery $q, array $p, array $refs, SuggestionSource $source, int $rank): IcdSuggestion
    {
        $spans = array_column(array_map(fn (QuerySpan $s) => [$s->ref, $s], $q->spans), 1, 0);
        $reason = match ($p['why']) {
            MatchKind::ExactCode => 'Kode tertulis di sumber',
            MatchKind::Synonym => 'Cocok dengan istilah "'.$p['term'].'"',
            MatchKind::SynonymTypo => 'Mirip istilah "'.$p['term'].'"',
            MatchKind::Fulltext => 'Cocok dengan judul resmi',
        };
        $e = $p['entry'];

        return new IcdSuggestion($e->system, $e->code, $e->display, $e->version, $reason,
            array_map(fn ($r) => ['ref' => $r] + $spans[$r]->source, $refs), $source, $rank, $p['why'], $e->perluDicek);
    }
}
