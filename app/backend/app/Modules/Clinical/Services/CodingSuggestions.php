<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Models\CodingPreference;
use App\Modules\Clinical\Models\CodingRule;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Shared\Terminology\Icd10Code;
use App\Shared\Terminology\Icd9cmCode;
use App\Shared\Terminology\IcdCatalog;

// ICD suggestions for an odontogram finding: only codes in coding_rule (most specific tooth_group with active rules) that are
// still valid in the official list. Order: this dentist's usage (count desc, last_used_at desc), then rule priority.
// No clinic-wide usage sort: another dentist's habit never reorders your list.
final class CodingSuggestions
{
    public const LIMIT = 3;

    /** @return list<array{icd10: string, display: string, icd9cm: ?string, icd9cm_display: ?string, priority: int, source: string, count: int}> */
    public static function for(string $condition, int $tooth, ?string $surface, string $dentistId): array
    {
        $surfaceCount = $surface === null ? null : 1;
        $rules = CodingRule::where('condition', $condition)->where('active', true)
            ->whereIn('tooth_group', Odontogram::toothGroups($tooth))
            ->where(fn ($q) => $q->whereNull('surface_count')->orWhere('surface_count', $surfaceCount))->get();
        $group = collect(Odontogram::toothGroups($tooth))->first(fn ($g) => $rules->contains('tooth_group', $g));
        $rules = $rules->where('tooth_group', $group);
        if ($rules->isEmpty()) {
            return [];
        }
        $icd10 = Icd10Code::whereIn('code', $rules->pluck('icd10'))->where('valid', true)->pluck('display', 'code');
        $icd9 = Icd9cmCode::whereIn('code', $rules->pluck('icd9cm')->filter())->where('valid', true)->pluck('display', 'code');
        $pref = CodingPreference::where('dentist_id', $dentistId)->where('condition', $condition)
            ->whereIn('icd10', $rules->pluck('icd10'))->get()->keyBy('icd10');

        return $rules->filter(fn ($r) => isset($icd10[$r->icd10]))
            ->sortBy([fn ($a, $b) => ($pref[$b->icd10]->count ?? 0) <=> ($pref[$a->icd10]->count ?? 0),
                fn ($a, $b) => ($pref[$b->icd10]->last_used_at ?? null) <=> ($pref[$a->icd10]->last_used_at ?? null),
                fn ($a, $b) => $a->priority <=> $b->priority])
            ->take(self::LIMIT)
            ->map(fn ($r) => ['icd10' => $r->icd10, 'display' => $icd10[$r->icd10],
                'icd9cm' => isset($icd9[$r->icd9cm]) ? $r->icd9cm : null, 'icd9cm_display' => $icd9[$r->icd9cm] ?? null,
                'priority' => $r->priority, 'source' => isset($pref[$r->icd10]) ? 'riwayat' : 'aturan', 'count' => $pref[$r->icd10]->count ?? 0])
            ->values()->all();
    }

    /**
     * Odontogram v2: ICD-10 for a finished entry, from the clinic rules that pair a diagnosis with the billed ICD-9-CM code on this tooth
     * group ("diisi dari aturan cabang", design/odontogram-kondisi.md). Same order as for(): this dentist's usage, then rule priority.
     * Without a matching rule: the catalog's default_icd10 while it is still official.
     */
    public static function forProcedure(string $icd9cm, ?int $tooth, string $dentistId): ?string
    {
        $groups = $tooth === null ? ['any'] : Odontogram::toothGroups($tooth); // no tooth (scaling): clinic-wide rules only
        $rules = CodingRule::where('icd9cm', $icd9cm)->where('active', true)->whereIn('tooth_group', $groups)->get();
        $group = collect($groups)->first(fn ($g) => $rules->contains('tooth_group', $g));
        $rules = $rules->where('tooth_group', $group);
        $valid = Icd10Code::whereIn('code', $rules->pluck('icd10'))->where('valid', true)->pluck('code')->all();
        $pref = CodingPreference::where('dentist_id', $dentistId)->whereIn('icd10', $valid)->get()->groupBy('icd10')->map->sum('count');

        $dx = $rules->filter(fn ($r) => in_array($r->icd10, $valid, true))
            ->sortBy([fn ($a, $b) => ($pref[$b->icd10] ?? 0) <=> ($pref[$a->icd10] ?? 0), fn ($a, $b) => $a->priority <=> $b->priority])
            ->first()?->icd10;
        if ($dx !== null) {
            return $dx;
        }
        // no rule (scaling, pemeriksaan, mahkota: rules are keyed by odontogram condition): the default a dentist set (S8)
        $default = ProcedureDefinition::where('procedure_code', $icd9cm)->value('default_icd10');

        return $default !== null && app(IcdCatalog::class)->icd10Exists($default) ? $default : null;
    }

    /** A dentist chose $icd10 for $condition: count++ and stamp last_used_at (tenant from Ctx). */
    public static function recordChoice(string $dentistId, string $condition, string $icd10): void
    {
        CodingPreference::firstOrCreate(['dentist_id' => $dentistId, 'condition' => $condition, 'icd10' => $icd10])
            ->increment('count', 1, ['last_used_at' => now()]);
    }
}
