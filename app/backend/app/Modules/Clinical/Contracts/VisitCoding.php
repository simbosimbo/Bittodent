<?php

namespace App\Modules\Clinical\Contracts;

// Implemented by Services\VisitCodingService (A1). Consumer: IcdSuggestions. Read side: the visit, the signed odontogram context
// and the open SOAP draft (no patient identifiers anywhere). Write side: ONE kind of write only, a code appended to the open
// visit's DRAFT SOAP (A.codes or P.codes). It never signs, never adds a signed version, never touches outbox, never changes S/O/text.
interface VisitCoding
{
    /** @return array{id: string, patient_id: string, branch_id: string, dentist_id: string, open: bool}|null null when not in this tenant */
    public function visit(string $visitId): ?array;

    /** Newest open visit of the patient (berlangsung, no signed note) or null. */
    public function openVisitOf(string $patientId): ?string;

    /**
     * Current odontogram of the patient: latest final, not superseded finding per tooth+surface (same rule as GET /chart).
     * version = 1 + number of rows it supersedes. Procedures = rows with a procedure_code.
     *
     * @return list<array{id: string, version: int, tooth: int, surface: ?string, condition: string, status: string, procedure_code: ?string}>
     */
    public function signedFindings(string $patientId): array;

    /**
     * The visit's open SOAP draft (unsigned), or null when there is none.
     *
     * @return array{version_id: string, revision: int, A: array{codes: list<string>, text: string}, P: array{codes: list<string>, text: string}}|null
     */
    public function openDraftNote(string $visitId): ?array;

    /**
     * Appends $code to the open visit's draft SOAP (ICD-10 -> A.codes, ICD-9-CM -> P.codes), creating the draft when there is
     * none. Locks the visit row; bumps the draft revision. Idempotent: a code already present changes nothing.
     *
     * @return array{version_id: string, revision: int, codes: list<string>, added: bool}
     *
     * @throws CodingRefused
     */
    public function addDraftCode(string $visitId, IcdSystem $system, string $code): array;
}
