<?php

namespace App\Modules\Clinical\Contracts;

// Implemented by Services\IntegrityFactsService. Consumer: Reporting (owner integrity report, unit 6). Current tenant only, read only.
// Window = [from, to) UTC. $branchIds null = every branch. Ids, codes and admin fields only (no SOAP, no NIK).
interface IntegrityFacts
{
    /**
     * External work (ada_di_tempat_lain), draft or final, recorded (created_at) in the window; corrections of an external row skipped.
     * confirmation not_required = recorded without `selesai` that day; pending/confirmed/rejected = recorded on a day with `selesai`.
     *
     * @return list<array{id: string, visit_id: ?string, patient_id: string, provider_id: string, procedure_code: ?string, tooth: ?int, confirmation: ?string, recorded_at: string}>
     */
    public function externals(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /**
     * Visits started in the window with completed coded work (the same set the close guard checks).
     *
     * @return list<array{visit_id: string, patient_id: string, branch_id: string, dentist_id: string, status: string, started_at: string, closed_without_invoice: bool, procedures: list<array{id: string, provider_id: string, procedure_code: string, tooth: ?int}>}>
     */
    public function visitsWithCompletedWork(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /**
     * Visits closed without invoice (ended_at in window) or walk-in attendance cancelled in the window.
     *
     * @return list<array{visit_id: string, patient_id: string, dentist_id: string, appointment_id: ?string, attendance_cancelled_at: ?string, closed_without_invoice: bool, close_reason: ?string, ended_at: ?string}>
     */
    public function cancelledVisits(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /**
     * Procedure corrections (unit A) requested in the window. provider_id = performing dentist of the corrected (original) row.
     * status: pending (waits for the owner) | diterapkan (within window) | disetujui | ditolak. chain_procedure_ids = correction chain of
     * the corrected row, root first (the billed line sits on one of them). No reason text.
     *
     * @return list<array{id: string, procedure_id: string, chain_procedure_ids: list<string>, provider_id: string, patient_id: string, visit_id: ?string, reason_type: string, within_window: bool, status: string, created_at: string, decided_at: ?string, self_approved_sole_owner: bool}>
     */
    public function procedureCorrections(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array;

    /** @param list<string> $visitIds  @return array<string, string> visit id => visit dentist id */
    public function dentistsOfVisits(array $visitIds): array;
}
