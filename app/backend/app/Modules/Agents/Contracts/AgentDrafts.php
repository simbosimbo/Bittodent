<?php

namespace App\Modules\Agents\Contracts;

// Agent output waits here until a dentist reviews it (D-001). Approving only marks the item `disetujui` and returns its
// payload; turning it into a note/odontogram version is done by the owning module through its own draft + sign flow
// (D-041). Nothing here writes clinical_note_version, tooth_finding or outbox.
interface AgentDrafts
{
    /** @return string draft id (state menunggu_review). payload/sourceSpans are stored encrypted. */
    public function propose(string $runId, DraftKind $kind, string $targetType, ?string $targetId, array $payload, array $sourceSpans = [],
        ?\DateTimeInterface $expiresAt = null): string;

    /**
     * Newest open (menunggu_review, not expired) draft of $kind for the target, created by a run that $requestedBy asked for.
     *
     * @return array{id: string, run_id: string, payload: array, created_at: \DateTimeInterface, expires_at: ?\DateTimeInterface}|null
     */
    public function latestOpen(DraftKind $kind, string $targetType, string $targetId, string $requestedBy): ?array;

    /** Marks the requester's other open drafts of $kind for the target `digantikan`. @return int how many */
    public function supersedeOpen(DraftKind $kind, string $targetType, string $targetId, string $requestedBy, string $exceptId): int;

    /**
     * Only for kinds that are not medical records (ringkasan): open drafts past expires_at become `kedaluwarsa`, then every
     * expired/superseded draft of that kind past expires_at has its content emptied once (purged_at set; metadata and hashes stay).
     * Current tenant only. Safe to run twice. @return int drafts purged
     */
    public function purgeExpired(DraftKind $kind, \DateTimeInterface $now): int;

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
