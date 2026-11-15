<?php

namespace App\Modules\Agents\Contracts;

// Agent output waits here until a dentist reviews it (D-001). Approving only marks the item `disetujui` and returns its
// payload; turning it into a note/odontogram version is done by the owning module through its own draft + sign flow
// (D-041). Nothing here writes clinical_note_version, tooth_finding or outbox.
interface AgentDrafts
{
    /** @return string draft id (state menunggu_review). payload/sourceSpans are stored encrypted. */
    public function propose(string $runId, DraftKind $kind, string $targetType, ?string $targetId, array $payload, array $sourceSpans = []): string;

    /**
     * Dentist only (permission ai_draft.review). Kind `ringkasan` is never approvable.
     *
     * @return array the approved payload
     *
     * @throws DraftReviewDenied
     */
    public function approve(string $draftId): array;

    /** @throws DraftReviewDenied */
    public function reject(string $draftId, string $reason): void;
}
