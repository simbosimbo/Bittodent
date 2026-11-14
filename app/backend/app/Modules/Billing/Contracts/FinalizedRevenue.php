<?php

namespace App\Modules\Billing\Contracts;

// Stub (no implementation/binding yet). Consumer: Compensation (bagi hasil). Only FINALIZED invoices count; drafts never.
interface FinalizedRevenue
{
    /** @return list<array{dentist_id: string, procedure_code: string, amount: int, finalized_at: string}> amounts in integer rupiah, current tenant only */
    public function forDentist(string $dentistId, \DateTimeInterface $from, \DateTimeInterface $to): array;
}
