<?php

namespace App\Modules\Agents\Services;

use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Modules\Agents\Contracts\DraftState;
use App\Modules\Agents\Models\AgentDraft;
use App\Modules\Agents\Models\AgentRun;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// Draft review (D-001). Writes only agent_draft + audit_event; never a clinical table.
final class DraftReviewService implements AgentDrafts
{
    public const PERMISSION = 'ai_draft.review';

    public function propose(string $runId, DraftKind $kind, string $targetType, ?string $targetId, array $payload, array $sourceSpans = []): string
    {
        AgentRun::findOrFail($runId); // same tenant only (global scope)
        $draft = AgentDraft::create([
            'run_id' => $runId, 'kind' => $kind, 'target_type' => $targetType, 'target_id' => $targetId,
            'payload_enc' => Crypto::encrypt(json_encode($payload, JSON_THROW_ON_ERROR)),
            'source_spans_enc' => $sourceSpans === [] ? null : Crypto::encrypt(json_encode($sourceSpans, JSON_THROW_ON_ERROR)),
            'state' => DraftState::MenungguReview,
        ]);
        Audit::log('ai_draf_buat', 'agent_draft', $draft->id, ['kind' => $kind->value, 'run_id' => $runId]);

        return $draft->id;
    }

    public function approve(string $draftId): array
    {
        $this->authorize($draftId);

        return DB::transaction(function () use ($draftId) {
            $draft = $this->reviewable($draftId, DraftState::Disetujui);
            $draft->update(['state' => DraftState::Disetujui, 'reviewer_id' => Ctx::current()->userId, 'reviewed_at' => now()]);
            Audit::log('ai_draf_setujui', 'agent_draft', $draft->id, ['kind' => $draft->kind->value, 'run_id' => $draft->run_id]);

            return $draft->payload();
        });
    }

    public function reject(string $draftId, string $reason): void
    {
        $this->authorize($draftId);
        DB::transaction(function () use ($draftId, $reason) {
            $draft = $this->reviewable($draftId, DraftState::Ditolak);
            $draft->update(['state' => DraftState::Ditolak, 'reviewer_id' => Ctx::current()->userId, 'reviewed_at' => now(),
                'reject_reason_enc' => Crypto::encrypt($reason)]);
            Audit::log('ai_draf_tolak', 'agent_draft', $draft->id, ['kind' => $draft->kind->value, 'run_id' => $draft->run_id]);
        });
    }

    /** Outside the transaction so the denial's audit row survives the exception. */
    private function authorize(string $draftId): void
    {
        $draft = AgentDraft::findOrFail($draftId); // other tenant => not found
        if (! Ctx::current()->can(self::PERMISSION)) {
            Audit::log('akses_ditolak', 'agent_draft', $draft->id, ['permission' => self::PERMISSION]);
            throw new DraftReviewDenied(DraftReviewDenied::FORBIDDEN);
        }
    }

    private function reviewable(string $draftId, DraftState $to): AgentDraft
    {
        $draft = AgentDraft::lockForUpdate()->findOrFail($draftId);
        if ($to === DraftState::Disetujui && ! $draft->kind->approvable()) {
            throw new DraftReviewDenied(DraftReviewDenied::NOT_APPROVABLE);
        }
        if (! $draft->state->canMoveTo($to, $draft->kind)) {
            throw new DraftReviewDenied(DraftReviewDenied::WRONG_STATE);
        }

        return $draft;
    }
}
