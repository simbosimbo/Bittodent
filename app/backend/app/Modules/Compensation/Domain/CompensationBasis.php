<?php

namespace App\Modules\Compensation\Domain;

// What a dentist's fee percentage is applied to (D-034). Default (Jerome): after material + lab costs are deducted.
enum CompensationBasis: string
{
    case AfterMaterialAndLab = 'after_material_and_lab';
    case BeforeCosts = 'before_costs';

    public static function default(): self
    {
        return self::AfterMaterialAndLab;
    }

    /** Integer rupiah the rule's percentage applies to. Not clamped: a negative base is a business question (perlu dicek). */
    public function baseRp(int $revenueRp, int $materialRp, int $labRp): int
    {
        return $this === self::AfterMaterialAndLab ? $revenueRp - $materialRp - $labRp : $revenueRp;
    }
}
