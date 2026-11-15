<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\CodingRule;
use App\Shared\Terminology\IcdCatalog;
use LogicException;

// USULAN / CONTOH: starting condition -> ICD mapping a clinic may edit. A clinical proposal, NOT official SATUSEHAT terminology
// or a national standard; must be reviewed by a dentist / medical-records officer. Every code is checked against the official
// ICD10_2010 / ICD9CM_2010 lists (displays stay the official English text in icd10_codes / icd9cm_codes).
// Skipped on purpose: `hilang` (not billed), scaling K03.6/K05.1 + 96.54 (no odontogram condition for calculus/gingiva).
final class CodingTemplate
{
    /** [condition, tooth_group, icd9cm, [icd10 in priority order]] */
    public const RULES = [
        ['karies', 'posterior', '23.2', ['K02.1', 'K02.0', 'K02.9']], // karies dentin, email, tak spesifik
        ['karies', 'anterior', '23.2', ['K02.1', 'K02.0']],
        ['perlu_dicabut', 'any', '23.09', ['K04.5', 'K04.1', 'K05.3']], // gigi tetap selain M3 (m3/sulung lebih spesifik)
        ['perlu_dicabut', 'sulung', '23.01', ['K00.6', 'K02.1', 'K04.1']], // persistensi, karies, nekrosis pulpa
        ['perlu_dicabut', 'm3', '23.19', ['K01.1']], // impaksi -> odontektomi
        ['sisa_akar', 'any', '23.11', ['K08.3']],
    ];

    /** Idempotent upsert for the current tenant (Ctx). Fails closed if a code is not in the official list. */
    public static function seed(): void
    {
        $icd = app(IcdCatalog::class);
        foreach (self::RULES as [$condition, $group, $icd9cm, $codes]) {
            foreach ($codes as $i => $icd10) {
                if (! $icd->icd10Exists($icd10) || ! $icd->icd9cmExists($icd9cm)) {
                    throw new LogicException("Kode $icd10 / $icd9cm tidak ada di daftar resmi ICD 2010.");
                }
                CodingRule::updateOrCreate(['condition' => $condition, 'tooth_group' => $group, 'icd10' => $icd10],
                    ['icd9cm' => $icd9cm, 'priority' => $i + 1, 'active' => true]);
            }
        }
    }
}
