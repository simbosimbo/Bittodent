<?php

namespace App\Modules\Clinical\Domain;

use Carbon\CarbonImmutable;

// Approximate date of work done at another clinic (unit 2). Patients often remember only the year or month, so precision is
// stored next to the date: "2025" => 2025-01-01/year, "2025-06" or "06/2025" => 2025-06-01/month, "12/06/2025" or "2025-06-12" => day.
final class ApproxDate
{
    public const PRECISIONS = ['day', 'month', 'year'];

    /** @return array{0: ?array{string, string}, 1: ?string} [[Y-m-d, precision], null] or [null, Indonesian error] */
    public static function parse(string $in, CarbonImmutable $today): array
    {
        $in = trim($in);
        $m = [];
        [$y, $mo, $d, $precision] = match (true) {
            (bool) preg_match('/^(\d{4})$/', $in, $m) => [$m[1], 1, 1, 'year'],
            (bool) preg_match('/^(\d{4})-(\d{1,2})$/', $in, $m) => [$m[1], $m[2], 1, 'month'],
            (bool) preg_match('/^(\d{1,2})\/(\d{4})$/', $in, $m) => [$m[2], $m[1], 1, 'month'],
            (bool) preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $in, $m) => [$m[1], $m[2], $m[3], 'day'],
            (bool) preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $in, $m) => [$m[3], $m[2], $m[1], 'day'],
            default => [null, null, null, null],
        };
        if ($precision === null || ! checkdate((int) $mo, (int) $d, (int) $y) || (int) $y < 1900) {
            return [null, 'Tanggal perkiraan tidak dikenal. Contoh: 2025, 06/2025, atau 12/06/2025.'];
        }
        $date = sprintf('%04d-%02d-%02d', $y, $mo, $d);
        if ($date > $today->format('Y-m-d')) {
            return [null, 'Tanggal perkiraan tidak boleh di masa depan.'];
        }

        return [[$date, $precision], null];
    }

    /** Stored date back to the input form of its precision ("2025", "2025-06", "2025-06-12"). */
    public static function format(string $date, string $precision): string
    {
        return substr($date, 0, ['year' => 4, 'month' => 7, 'day' => 10][$precision]);
    }
}
