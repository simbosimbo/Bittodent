<?php

namespace App\Modules\Clinical\Contracts;

// Read-only, signed/final data only (never drafts). Implemented by Services\ClinicalHistoryService. Consumer: ClinicalSummary.
// Returns decrypted SOAP: keep it in memory, never log it.
interface ClinicalHistory
{
    /**
     * Visits of the patient in the last $months (newest first, at most $maxVisits), the effective signed note version of each
     * (a signed version superseded by a later SIGNED version is left out), the current odontogram (latest final finding per
     * tooth+surface that nothing supersedes, any date) and the latest tooth baseline. 404 when the patient is not in this tenant.
     *
     * @return array{
     *   visits: list<array{id: string, branch_id: string, dentist_id: string, started_at: \DateTimeInterface}>,
     *   notes: list<array{id: string, note_id: string, visit_id: string, version: int, content_hash: string, signed_at: \DateTimeInterface, signed_by: string, soap: array}>,
     *   findings: list<array{id: string, visit_id: ?string, tooth: int, surface: ?string, condition: string, status: string, procedure_code: ?string, finalized_at: \DateTimeInterface}>,
     *   baseline: ?array{id: string, version: int, dentition: string, teeth: array, created_at: \DateTimeInterface},
     *   truncated: bool,
     * }
     */
    public function signedHistory(string $patientId, int $months, int $maxVisits): array;

    /** True when $dentistId was the dentist of one of the patient's visits in the last $months. */
    public function treatedWithin(string $patientId, string $dentistId, int $months): bool;
}
