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
