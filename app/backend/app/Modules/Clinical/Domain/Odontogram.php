<?php

namespace App\Modules\Clinical\Domain;

// Odontogram rules (D-021, design/odontogram/README.md + legend.json "conditions"; internal legend, not an official form).
final class Odontogram
{
    /** legend.json conditions with applies-to = surface */
    public const SURFACE_CONDITIONS = ['sehat', 'karies', 'tambalan'];

    /** legend.json conditions with applies-to = whole-tooth (stored with surface = null) */
    public const WHOLE_CONDITIONS = ['mahkota', 'hilang', 'sisa_akar', 'perlu_dicabut', 'implan'];

    /** L is stored for lingual and palatal; the UI shows "P" on upper teeth. */
    public const SURFACES = ['M', 'D', 'O', 'I', 'B', 'L'];

    /** FDI: permanent 11-18..41-48, primary 51-55..81-85. */
    public static function validTooth(int $t): bool
    {
        [$q, $n] = [intdiv($t, 10), $t % 10];

        return $n >= 1 && (($q >= 1 && $q <= 4 && $n <= 8) || ($q >= 5 && $q <= 8 && $n <= 5));
    }

    /** Incisors + canines (position 1-3) use I, premolars/molars use O. */
    public static function isAnterior(int $t): bool
    {
        return $t % 10 <= 3;
    }

    /** Primary (sulung) teeth 51-85. */
    public static function isPrimary(int $t): bool
    {
        return intdiv($t, 10) >= 5;
    }

    /** Third molars 18, 28, 38, 48. */
    public static function isThirdMolar(int $t): bool
    {
        return $t % 10 === 8 && ! self::isPrimary($t);
    }

    /** coding_rule.tooth_group values that apply to a valid tooth, most specific first: m3 > sulung > anterior|posterior > any. */
    public static function toothGroups(int $t): array
    {
        return [...(self::isThirdMolar($t) ? ['m3'] : []), ...(self::isPrimary($t) ? ['sulung'] : []),
            self::isAnterior($t) ? 'anterior' : 'posterior', 'any'];
    }

    /** Canonical letter order of a procedure's surface combination (Open Dental style "MOD"). */
    public const SURFACE_ORDER = 'MODIBL';

    /**
     * Procedure surfaces ("dom", "M,O,D" or ['M','O','D']) => [canonical "MOD", null] or [null, Indonesian error].
     * Rejects empty, unknown letters, duplicates, O on anterior and I on posterior teeth.
     */
    public static function surfaces(int $tooth, string|array $in): array
    {
        $letters = is_array($in) ? array_map(fn ($s) => strtoupper(trim((string) $s)), $in) : str_split(strtoupper(preg_replace('/[\s,]/', '', $in)));
        $letters = array_values(array_filter($letters, fn ($s) => $s !== ''));
        $err = match (true) {
            ! $letters => 'Permukaan wajib diisi (M, O, D, I, B, L).',
            (bool) array_diff($letters, self::SURFACES) => 'Permukaan hanya boleh M, O, D, I, B, L.',
            count($letters) !== count(array_unique($letters)) => 'Permukaan tidak boleh diulang.',
            in_array('O', $letters, true) && self::isAnterior($tooth) => 'Permukaan O hanya untuk premolar dan molar.',
            in_array('I', $letters, true) && ! self::isAnterior($tooth) => 'Permukaan I hanya untuk insisor dan kaninus.',
            default => null,
        };
        if ($err) {
            return [null, $err];
        }
        usort($letters, fn ($a, $b) => strpos(self::SURFACE_ORDER, $a) <=> strpos(self::SURFACE_ORDER, $b));

        return [implode('', $letters), null];
    }

    /** Null when valid, else an Indonesian message. */
    public static function error(int $tooth, ?string $surface, string $condition): ?string
    {
        return match (true) {
            ! self::validTooth($tooth) => 'Nomor gigi FDI tidak dikenal.',
            ! in_array($condition, [...self::SURFACE_CONDITIONS, ...self::WHOLE_CONDITIONS], true) => 'Kondisi tidak ada di legenda.',
            in_array($condition, self::WHOLE_CONDITIONS, true) => $surface === null ? null : 'Kondisi ini untuk seluruh gigi, tanpa permukaan.',
            $surface === null || ! in_array($surface, self::SURFACES, true) => 'Permukaan wajib salah satu M, D, O, I, B, L.',
            $surface === 'O' && self::isAnterior($tooth) => 'Permukaan O hanya untuk premolar dan molar.',
            $surface === 'I' && ! self::isAnterior($tooth) => 'Permukaan I hanya untuk insisor dan kaninus.',
            default => null,
        };
    }
}
