<?php

namespace App\Modules\Clinical\Contracts;

// Implemented by Services\TreatmentPlanService (A2). Consumer: TreatmentSuggestions (rule-based suggestions from the odontogram).
// Read side: the current final odontogram + every planned/done item; write side: ONE kind of write only, a DRAFT plan item
// (status direncanakan, source ai_draft) on an open visit. It never signs, never finalizes and never touches a clinical note:
// the plan becomes part of the record only when the dentist signs the visit (D-001, D-041).
//
// Seam with PR #52 (procedure_record): there the same contract maps to a draft procedure_record (status direncanakan,
// tooth + surfaces + procedure_code, source ai_draft) instead of tooth_finding rows. Callers do not change.
interface TreatmentPlan
{
    /** Odontogram legend codes the rules may match. @return array{surface: list<string>, whole: list<string>} */
    public function conditions(): array;

    /**
     * Current odontogram: latest final, not superseded finding per tooth+surface (same rule as GET /chart).
     * version = 1 + number of rows it supersedes (a finding is never edited; a change is a new row).
     *
     * @return list<array{id: string, version: int, tooth: int, surface: ?string, condition: string, status: string, procedure_code: ?string, finalized_at: ?string}>
     */
    public function currentFindings(string $patientId): array;

    /**
     * Items that already carry a plan or are done: current final rows with status direncanakan/selesai/dirujuk and every draft
     * row (any visit, any author) of the patient. Used to avoid suggesting what is already planned or done.
     *
     * @return list<array{tooth: int, surface: ?string, status: string, procedure_code: ?string, state: string}>
     */
    public function plannedItems(string $patientId): array;

    /**
     * The visit the plan would land on. null when not found in this tenant.
     *
     * @return array{id: string, patient_id: string, branch_id: string, dentist_id: string, open: bool}|null
     */
    public function visit(string $visitId): ?array;

    /** Newest open visit of the patient (berlangsung, no signed note) or null. */
    public function openVisitOf(string $patientId): ?string;

    /**
     * Adds a draft plan item on an open visit (locks the visit row). Idempotent: an identical draft already there is returned.
     * A different draft on the same tooth+surface of that visit is never overwritten (PlanRefused::DRAFT_EXISTS).
     *
     * @return list<string> ids of the draft rows (one per surface; procedure_code on the first only, so it bills once)
     *
     * @throws PlanRefused
     */
    public function addPlannedDraft(string $visitId, PlannedTreatment $item): array;
}
