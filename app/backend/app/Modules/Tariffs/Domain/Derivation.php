<?php

namespace App\Modules\Tariffs\Domain;

use App\Modules\Tariffs\Models\TariffRule;
use Illuminate\Support\Collection;

// Price arithmetic for derivation rules and bulk edits. Integer rupiah only: no floats anywhere.
final class Derivation
{
    public const KINDS = ['percent', 'amount'];

    // unit in rupiah + mode. nearest_* rounds a half UP (325500 -> 326000 for nearest_1000); results are never negative.
    public const ROUNDING = ['none' => [1, 'nearest'], 'nearest_100' => [100, 'nearest'], 'nearest_500' => [500, 'nearest'],
        'nearest_1000' => [1000, 'nearest'], 'ceil_1000' => [1000, 'ceil'], 'floor_1000' => [1000, 'floor']];

    /** Exact result as a fraction num/100 (percent: base*(100+p)/100; amount: (base+a)*100/100). */
    private static function numerator(int $base, string $kind, int $value): int
    {
        return $kind === 'percent' ? $base * (100 + $value) : ($base + $value) * 100;
    }

    public static function negative(int $base, string $kind, int $value): bool
    {
        return self::numerator($base, $kind, $value) < 0;
    }

    /** Rounded price, clamped at 0 (a write that would go negative is rejected earlier; the clamp only guards later Umum cuts). */
    public static function apply(int $base, string $kind, int $value, string $rounding): int
    {
        $num = max(0, self::numerator($base, $kind, $value));
        [$unit, $mode] = self::ROUNDING[$rounding];
        $den = 100 * $unit;

        return $unit * match ($mode) {
            'nearest' => intdiv(2 * $num + $den, 2 * $den),
            'ceil' => intdiv($num + $den - 1, $den),
            'floor' => intdiv($num, $den),
        };
    }

    /**
     * Most specific enabled rule for one Umum tariff row: procedure_code+variant > category > band-wide.
     *
     * @param  Collection<int, TariffRule>  $rules  enabled rules only
     */
    public static function pick(Collection $rules, string $band, ?string $field, string $code, string $variant, ?string $category): ?object
    {
        $match = $rules->filter(fn ($r) => $r->band === $band && $r->field === $field
            && ($r->procedure_code === null || ($r->procedure_code === $code && $r->variant === $variant))
            && ($r->category === null || $r->category === $category));

        return $match->sortByDesc(fn ($r) => $r->procedure_code !== null ? 2 : ($r->category !== null ? 1 : 0))->first();
    }
}
