<?php

namespace App\Modules\Billing\Contracts;

// Implemented by Services\IntegrityFactsService. Consumer: Reporting (owner integrity report, unit 6). Current tenant only, read only.
// Window = [from, to) UTC. $branchIds null = every branch (invoice.branch_id). Integer rupiah.
interface IntegrityFacts
{
    /** @param list<string> $procedureIds  @return list<string> the ones that have an invoice line */
    public function billedProcedureIds(array $procedureIds): array;

    /**
     * Discount / write-off adjustments created in the window. status: applied (normal) | pending | approved | rejected (Rp0 ones).
     *
     * @return list<array{id: string, invoice_id: string, visit_id: string, patient_id: string, kind: string, amount_rp: int, created_at: string, zero: bool, status: string, decided_at: ?string, self_approved_sole_owner: bool}>
     */
    public function adjustments(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /** Invoice lines priced Rp0 (tariff Rp0, no approval) created in the window. @return list<array{procedure_id: string, doctor_id: ?string, visit_id: string, patient_id: string, created_at: string}> */
    public function zeroPriceLines(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;
}
