<?php

namespace App\Modules\Scribe\Contracts;

use App\Modules\Agents\Contracts\DraftReviewDenied;

// Orchestrates one dictation session: store encrypted audio, transcribe, draft SOAP (via AgentRuns::call
// + CitationValidator + AgentDrafts::propose), wipe audio. Never writes clinical_note_version.
interface ScribeEngine
{
    /**
     * Create a session, store audio, process, return the session id.
     * $dentistId must be the visit's treating dentist.
     */
    public function ingest(string $visitId, string $dentistId, string $plaintextAudio, string $mime, int $durationSec): string;

    /** Re-run processing for a failed session that still has audio (or the 24h sweeper wipes it). */
    public function process(string $sessionId): void;

    /** Wipe leftover audio older than 24h (failure path). Audited. */
    public function sweepExpiredAudio(\DateTimeInterface $now): int;

    /**
     * Approve one SOAP item draft. Does not write a clinical note (D-001, D-017).
     * $editedText, when different from the draft payload, is returned and audited but the draft row stays immutable.
     *
     * @return array{id: string, section: string, text: string, refs: list<string>}
     *
     * @throws DraftReviewDenied
     */
    public function approveItem(string $draftId, ?string $editedText = null): array;

    /** @throws DraftReviewDenied */
    public function rejectItem(string $draftId, string $reason): void;

    /**
     * Status + items for the visit's latest session (and open drafts). When paid is off, still returns
     * paid_enabled=false so the UI can show a disabled state (HTTP 200). Mutating calls must 403.
     *
     * @return array<string, mixed>
     */
    public function statusForVisit(string $visitId): array;
}
