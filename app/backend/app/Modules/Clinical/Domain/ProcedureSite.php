<?php

namespace App\Modules\Clinical\Domain;

// Do two procedures touch the same place? Used by unit 2: an external entry may not sit on a site that got `selesai` work today.
// Same tooth counts when either side is whole-tooth (no surfaces) or they share a surface letter; range/quadrant/arch/mouth
// expand to their teeth (permanent + primary), so mouth overlaps everything.
final class ProcedureSite
{
    /** @param array{treat_area: string, tooth: ?int, surfaces: ?string, tooth_range: ?string, quadrant: ?int, arch: ?string} $a */
    public static function overlaps(array $a, array $b): bool
    {
        $shared = array_intersect(self::teeth($a), self::teeth($b));
        if (! $shared) {
            return false;
        }
        $sa = (string) ($a['surfaces'] ?? '');
        $sb = (string) ($b['surfaces'] ?? '');

        return $sa === '' || $sb === '' || array_intersect(str_split($sa), str_split($sb)) !== [];
    }

    /** @return list<int> */
    public static function teeth(array $p): array
    {
        $all = fn (array $quadrants) => array_merge(...array_map(fn ($q) => [
            ...array_map(fn ($n) => $q * 10 + $n, range(1, 8)), ...array_map(fn ($n) => ($q + 4) * 10 + $n, range(1, 5))], $quadrants));

        return match ($p['treat_area']) {
            'surface', 'tooth' => [(int) $p['tooth']],
            'quadrant' => $all([(int) $p['quadrant']]),
            'arch' => $all($p['arch'] === 'atas' ? [1, 2] : [3, 4]),
            'mouth' => $all([1, 2, 3, 4]),
            'range' => self::range($p['tooth_range'], $all),
            default => [],
        };
    }

    // position along the arch, right to left from the patient's view: 18..11 = 1..8, 21..28 = 9..16 (primary 5x/6x = 1x/2x, 8x/7x = 4x/3x)
    private static function range(string $r, callable $all): array
    {
        $pos = function (int $t) {
            $q = intdiv($t, 10);
            $q = $q > 4 ? $q - 4 : $q;

            return in_array($q, [1, 4], true) ? 9 - $t % 10 : 8 + $t % 10;
        };
        [$a, $b] = array_map('intval', explode('-', $r));
        $upper = in_array(intdiv($a, 10), [1, 2, 5, 6], true);
        [$lo, $hi] = [min($pos($a), $pos($b)), max($pos($a), $pos($b))];

        return array_values(array_filter($all($upper ? [1, 2] : [3, 4]), fn ($t) => $pos($t) >= $lo && $pos($t) <= $hi));
    }
}
