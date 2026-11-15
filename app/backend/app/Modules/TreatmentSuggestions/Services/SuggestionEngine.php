<?php

namespace App\Modules\TreatmentSuggestions\Services;

use App\Modules\TreatmentSuggestions\Domain\Candidate;
use App\Modules\TreatmentSuggestions\Domain\Rule;

// Pure and deterministic: same rules + findings + plans => same suggestions in the same order. No model, no I/O.
// Only findings that are recorded, final and still "kondisi_pantau" can raise a suggestion; nothing is suggested for a tooth
// that already has the same procedure planned/done, or for a surface the dentist is already drafting in an open visit.
final class SuggestionEngine
{
    private const SURFACE_ORDER = ['M', 'O', 'I', 'D', 'B', 'L'];

    /**
     * @param  list<Rule>  $rules  effective, active rules
     * @param  list<array{id: string, version: int, tooth: int, surface: ?string, condition: string, status: string}>  $findings  current final odontogram
     * @param  list<array{tooth: int, surface: ?string, status: string, procedure_code: ?string, state: string}>  $planned
     * @param  array<string, int>  $approvals  rule_key => times this dentist approved it (signal)
     * @return list<Candidate>
     */
    public function suggest(array $rules, array $findings, array $planned, array $approvals = []): array
    {
        usort($rules, fn (Rule $a, Rule $b) => [$a->priority, $a->key] <=> [$b->priority, $b->key]);
        $codesOnTooth = [];
        $draftSurfaces = [];
        foreach ($planned as $p) {
            if ($p['procedure_code'] !== null && in_array($p['status'], ['direncanakan', 'selesai', 'dirujuk'], true)) {
                $codesOnTooth[$p['tooth'].'|'.$p['procedure_code']] = true;
            }
            if ($p['state'] === 'draft') {
                $draftSurfaces[$p['tooth'].'|'.($p['surface'] ?? '*')] = true;
            }
        }

        /** @var array<string, array{rule: Rule, findings: list<array>}> $groups tooth|code */
        $groups = [];
        foreach ($findings as $f) {
            if ($f['status'] !== 'kondisi_pantau' || isset($draftSurfaces[$f['tooth'].'|'.($f['surface'] ?? '*')])) {
                continue;
            }
            foreach ($rules as $r) {
                if (! $r->matches($f) || isset($codesOnTooth[$f['tooth'].'|'.$r->procedureCode])) {
                    continue;
                }
                $g = $f['tooth'].'|'.$r->procedureCode; // one procedure per tooth: the first (highest-priority) rule owns it
                $groups[$g] ??= ['rule' => $r, 'findings' => []];
                $groups[$g]['findings'][] = $f;
                break;
            }
        }

        $out = [];
        foreach ($groups as $g) {
            $fs = $g['findings'];
            usort($fs, fn ($a, $b) => self::rank($a['surface']) <=> self::rank($b['surface']));
            $surfaces = array_values(array_unique(array_filter(array_column($fs, 'surface'))));
            $out[] = new Candidate($g['rule'], $fs[0]['tooth'], $surfaces, $fs[0]['condition'],
                array_map(fn ($f) => ['type' => 'finding', 'id' => $f['id'], 'version' => $f['version'], 'tooth' => $f['tooth'],
                    'surface' => $f['surface'], 'condition' => $f['condition']], $fs),
                $approvals[$g['rule']->key] ?? 0);
        }
        usort($out, fn (Candidate $a, Candidate $b) => [$a->rule->priority, -$a->approvals, $a->tooth, $a->rule->key]
            <=> [$b->rule->priority, -$b->approvals, $b->tooth, $b->rule->key]);

        return $out;
    }

    private static function rank(?string $s): int
    {
        $i = array_search($s, self::SURFACE_ORDER, true);

        return $i === false ? 99 : $i;
    }
}
