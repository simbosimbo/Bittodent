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

    /**
     * Invoice lines priced Rp0 (tariff anomaly, never a correction) created in the window. tariff_status: pending | approved (owner,
     * unit B) | null (historic Rp0 line from before the tariff_zero flag).
     *
     * @return list<array{id: string, procedure_id: string, procedure_code: ?string, doctor_id: ?string, invoice_id: string, visit_id: string, patient_id: string, created_at: string, tariff_status: ?string}>
     */
    public function zeroPriceLines(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /** @param list<string> $procedureIds  @return array<string, int> procedure id => billed line price (sum) */
    public function linePricesByProcedure(array $procedureIds): array;

    /**
     * Correction documents (unit B/C) created in the window. status: applied (no approval needed) | pending | approved | rejected.
     * doctor_id = invoice_line.doctor_id of the credited line (credit notes, refunds via their credit note); null for voids (invoice level).
     * Void amount_rp = sum of the invoice's line prices.
     *
     * @return array{credit_notes: list<array>, voids: list<array>, refunds: list<array>} rows: {id, kind, invoice_id, visit_id, patient_id,
     *                                                                                    doctor_id, amount_rp, is_full, number, status, created_at, decided_at, self_approved_sole_owner}
     */
    public function reversals(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /**
     * "Perlu tinjau koreksi" flags (line_correction) created in the window; handled = credit note / corrected line billed / cashier review.
     *
     * @return list<array{id: string, invoice_id: string, visit_id: string, patient_id: string, doctor_id: ?string, reason_type: string, created_at: string, handled: bool}>
     */
    public function lineCorrections(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;
}
