<?php

namespace App\Modules\Compensation\Contracts;

use App\Modules\Compensation\Domain\CompensationBasis;

/**
 * Stub (no implementation/binding yet). Dentist fee for one finalized procedure (D-034).
 *
 * - Rules are effective-dated per dentist + procedure group (+ optional difficulty level): percentage or fixed amount,
 *   with a CompensationBasis; a rule saved without an explicit basis uses CompensationBasis::default() (after material + lab).
 * - The rule applied is the one valid on $performedOn. Saving a new rule never recomputes past periods: computed fees
 *   are stored, and a new rule only has a later valid_from (old rules are never edited or deleted).
 * - Revenue comes only from Billing\Contracts\FinalizedRevenue; material/lab costs from their future owner. Integer rupiah.
 * - Owner-only data; every change or export is audited.
 */
interface FeeCalculator
{
    public function feeFor(string $dentistId, string $procedureCode, string $level, int $revenueRp, int $materialRp, int $labRp,
        \DateTimeInterface $performedOn): int;

    public function basisFor(string $dentistId, string $procedureCode, \DateTimeInterface $performedOn): CompensationBasis;
}
