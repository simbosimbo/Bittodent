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

    public function propose(string $runId, DraftKind $kind, string $targetType, ?string $targetId, array $payload, array $sourceSpans = [],
        ?\DateTimeInterface $expiresAt = null): string
    {
        AgentRun::findOrFail($runId); // same tenant only (global scope)
        $draft = AgentDraft::create([
            'run_id' => $runId, 'kind' => $kind, 'target_type' => $targetType, 'target_id' => $targetId,
            'payload_enc' => Crypto::encrypt(json_encode($payload, JSON_THROW_ON_ERROR)),
            'source_spans_enc' => $sourceSpans === [] ? null : Crypto::encrypt(json_encode($sourceSpans, JSON_THROW_ON_ERROR)),
            'state' => DraftState::MenungguReview,
            'expires_at' => $expiresAt,
        ]);
        Audit::log('ai_draf_buat', 'agent_draft', $draft->id, ['kind' => $kind->value, 'run_id' => $runId]);

        return $draft->id;
    }

    public function latestOpen(DraftKind $kind, string $targetType, string $targetId, string $requestedBy): ?array
    {
        $d = $this->open($kind, $targetType, $targetId, $requestedBy)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->orderByDesc('created_at')->orderByDesc('id')->first();

        return $d ? ['id' => $d->id, 'run_id' => $d->run_id, 'payload' => $d->payload(), 'created_at' => $d->created_at, 'expires_at' => $d->expires_at] : null;
    }

    public function supersedeOpen(DraftKind $kind, string $targetType, string $targetId, string $requestedBy, string $exceptId): int
    {
        $n = 0;
        foreach ($this->open($kind, $targetType, $targetId, $requestedBy)->whereKeyNot($exceptId)->get() as $d) {
            $d->update(['state' => DraftState::Digantikan]);
            $n++;
        }

        return $n;
    }

    public function purgeExpired(DraftKind $kind, \DateTimeInterface $now): int
    {
        if ($kind->approvable()) {
            throw new \LogicException('Hanya draf yang bukan rekam medis (ringkasan) yang boleh dikosongkan.');
        }
        foreach (AgentDraft::where('kind', $kind)->where('state', DraftState::MenungguReview)->where('expires_at', '<=', $now)->get() as $d) {
            $d->update(['state' => DraftState::Kedaluwarsa]);
        }
        $n = 0;
        foreach (AgentDraft::where('kind', $kind)->whereIn('state', [DraftState::Kedaluwarsa, DraftState::Digantikan])
            ->where('expires_at', '<=', $now)->whereNull('purged_at')->get() as $d) {
            $d->update(['payload_enc' => null, 'source_spans_enc' => null, 'purged_at' => $now]);
            $n++;
        }
        if ($n > 0) {
            Audit::log('ai_draf_kosongkan', 'agent_draft', null, ['kind' => $kind->value, 'count' => $n]);
        }

        return $n;
    }

    public function supersede(string $draftId): bool
    {
        return DB::transaction(function () use ($draftId) {
            $d = AgentDraft::lockForUpdate()->findOrFail($draftId);
            if ($d->state !== DraftState::MenungguReview) {
                return false;
            }
            $d->update(['state' => DraftState::Digantikan]);
            Audit::log('ai_draf_ganti', 'agent_draft', $d->id, ['kind' => $d->kind->value]);

            return true;
        });
    }

    public function forTarget(DraftKind $kind, string $targetType, string $targetId): array
    {
        return AgentDraft::where('kind', $kind)->where('target_type', $targetType)->where('target_id', $targetId)
            ->orderBy('created_at')->orderBy('id')->get()
            ->map(fn (AgentDraft $d) => ['id' => $d->id, 'run_id' => $d->run_id, 'state' => $d->state, 'payload' => $d->payload_enc === null ? [] : $d->payload(),
                'reviewer_id' => $d->reviewer_id, 'reviewed_at' => $d->reviewed_at, 'created_at' => $d->created_at])
            ->values()->all();
    }

    public function reviewedBy(DraftKind $kind, string $reviewerId, int $limit = 200): array
    {
        return AgentDraft::where('kind', $kind)->where('reviewer_id', $reviewerId)->whereNotNull('payload_enc')
            ->whereIn('state', [DraftState::Disetujui, DraftState::Ditolak])
            ->orderByDesc('reviewed_at')->limit(max(1, min($limit, 1000)))->get()
            ->map(fn (AgentDraft $d) => ['state' => $d->state, 'payload' => $d->payload()])->values()->all();
    }

    private function open(DraftKind $kind, string $targetType, string $targetId, string $requestedBy)
    {
        return AgentDraft::where('kind', $kind)->where('target_type', $targetType)->where('target_id', $targetId)
            ->where('state', DraftState::MenungguReview)->whereIn('run_id', AgentRun::select('id')->where('requested_by', $requestedBy));
    }

    public function approve(string $draftId, ?DraftKind $as = null): array
    {
        $this->authorize($draftId);

        return DB::transaction(function () use ($draftId, $as) {
            $draft = $this->reviewable($draftId, DraftState::Disetujui, $as);
            $draft->update(['state' => DraftState::Disetujui, 'reviewer_id' => Ctx::current()->userId, 'reviewed_at' => now()]);
            Audit::log('ai_draf_setujui', 'agent_draft', $draft->id, ['kind' => $draft->kind->value, 'run_id' => $draft->run_id]);

            return $draft->payload();
        });
    }

    public function reject(string $draftId, string $reason, ?DraftKind $as = null): void
    {
        $this->authorize($draftId);
        DB::transaction(function () use ($draftId, $reason, $as) {
            $draft = $this->reviewable($draftId, DraftState::Ditolak, $as);
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

    private function reviewable(string $draftId, DraftState $to, ?DraftKind $as): AgentDraft
    {
        $draft = AgentDraft::lockForUpdate()->findOrFail($draftId);
        if ($as !== null && $draft->kind !== $as) {
            throw new DraftReviewDenied(DraftReviewDenied::WRONG_KIND);
        }
        if ($as === null && $draft->kind->ownFlow()) {
            throw new DraftReviewDenied(DraftReviewDenied::OWN_FLOW);
        }
        if ($to === DraftState::Disetujui && ! $draft->kind->approvable()) {
            throw new DraftReviewDenied(DraftReviewDenied::NOT_APPROVABLE);
        }
        if (! $draft->state->canMoveTo($to, $draft->kind)) {
            throw new DraftReviewDenied(DraftReviewDenied::WRONG_STATE);
        }

        return $draft;
    }
}
