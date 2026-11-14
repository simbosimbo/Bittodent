<?php

namespace App\Modules\Tariffs\Domain;

use App\Modules\Tariffs\Models\Tariff;

// Editable starting template of difficulty levels (D-035). A setup aid, NOT a clinical guide. Fake prices.
// Level 1 code is 'standar' (= tooth_finding.variant default). Last level = highest = reason required when chosen.
// ICD-9-CM codes are examples (perlu dicek).
final class DifficultyTemplate
{
    public const LEVELS = [
        '23.2' => ['Tumpatan (contoh)', [['standar', '1 permukaan', 250000], ['p2', '2 permukaan', 350000], ['p3plus', '3+ permukaan', 450000]]],
        '96.54' => ['Scaling (contoh)', [['standar', 'Ringan', 200000], ['sedang', 'Sedang', 300000], ['berat', 'Berat', 400000]]],
        '23.09' => ['Pencabutan gigi (contoh)', [['standar', 'Biasa', 150000], ['sulit', 'Sulit', 300000], ['bedah', 'Bedah', 600000]]],
    ];

    /** Seeds the template for the current tenant (Ctx). */
    public static function seed(string $validFrom): void
    {
        foreach (self::LEVELS as $code => [$name, $levels]) {
            foreach ($levels as $i => [$variant, $label, $price]) {
                Tariff::create(['procedure_code' => $code, 'name' => $name, 'variant' => $variant, 'level_label' => $label,
                    'level_rank' => $i + 1, 'price_rp' => $price, 'valid_from' => $validFrom]);
            }
        }
    }
}
