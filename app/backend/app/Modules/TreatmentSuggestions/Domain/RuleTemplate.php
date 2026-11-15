<?php

namespace App\Modules\TreatmentSuggestions\Domain;

use App\Modules\TreatmentSuggestions\Models\TreatmentRule;

// Editable STARTING rules for a new clinic, synthetic like Tariffs\Domain\DifficultyTemplate (same procedure codes, which are
// examples: "perlu dicek"). A setup aid, NOT a clinical guideline; the clinic's dentist changes them with new versions.
final class RuleTemplate
{
    /** rule_key => [condition, surfaces|null, procedure_code, priority] */
    public const RULES = [
        'sisa-akar-cabut' => ['sisa_akar', null, '23.09', 10],
        'perlu-dicabut-cabut' => ['perlu_dicabut', null, '23.09', 10],
        'karies-tumpatan' => ['karies', null, '23.2', 20],
    ];

    /** For the current tenant (Ctx). Skips keys that already exist, so running it twice adds nothing. */
    public static function seed(): void
    {
        foreach (self::RULES as $key => [$condition, $surfaces, $code, $priority]) {
            if (! TreatmentRule::where('rule_key', $key)->exists()) {
                TreatmentRule::create(['rule_key' => $key, 'version' => 1, 'condition' => $condition, 'surfaces' => $surfaces,
                    'procedure_code' => $code, 'priority' => $priority, 'active' => true]);
            }
        }
    }
}
