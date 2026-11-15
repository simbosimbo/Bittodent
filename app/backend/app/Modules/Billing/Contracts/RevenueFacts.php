<?php

namespace App\Modules\Billing\Contracts;

// Implemented by Services\RevenueFactsService. Consumer: Reporting (revenue report, board KL07-KL09). Current tenant, read only.
// Window = [from, to) UTC; one branch (the report's). Integer rupiah. Amounts only: no clinical text beyond the tariff name.
interface RevenueFacts
{
    /** Money received (invoice_payment.paid_at in the window). @return list<array{paid_at: string, kind: string, bank_name: ?string, amount_rp: int}> */
    public function payments(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array;

    /** Billed lines created in the window. @return list<array{doctor_id: ?string, patient_id: string, procedure_name: string, price_rp: int}> */
    public function lines(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array;

    /** Open invoices with a balance (piutang), any age. @return list<array{patient_id: string, created_at: string, balance_rp: int, items: list<string>}> */
    public function receivables(string $branchId): array;

    /** Closed cashier shifts with a cash difference, closed in the window. @return list<array{user_id: string, closed_at: string, difference_rp: int, reason: ?string}> */
    public function shiftDifferences(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array;
}
