<?php

namespace App\Modules\Clinical\Events;

// Dispatched (sync, inside the close transaction) before a visit becomes `selesai`. Billing listens and calls block() when a
// completed procedure has no invoice line (unit 4). Clinical decides what a block means (cancelled attendance = may close with
// a reason), so Clinical never depends on Billing.
final class VisitClosing
{
    /** @var list<string> */
    public array $unbilledProcedureIds = [];

    /** @param list<string> $completedProcedureIds `selesai` procedures (draft or final) that must each have an invoice line */
    public function __construct(
        public readonly string $tenantId,
        public readonly string $visitId,
        public readonly array $completedProcedureIds,
    ) {}

    /** @param list<string> $procedureIds */
    public function block(array $procedureIds): void
    {
        $this->unbilledProcedureIds = array_values(array_unique([...$this->unbilledProcedureIds, ...$procedureIds]));
    }

    public function blocked(): bool
    {
        return $this->unbilledProcedureIds !== [];
    }
}
