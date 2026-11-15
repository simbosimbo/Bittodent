<?php

namespace App\Modules\Agents\Services;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentCallResult;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\ReplyCheck;
use App\Modules\Agents\Contracts\RunOutcome;
use App\Modules\Agents\Models\AgentRun;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\ModelUnavailable;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Throwable;

// Wraps every model call: agent_run row before the call, completed once after; one audit_event `ai_panggil` either way.
// Fails safe: a model error or a rejected reply never throws to the caller, it returns a non-ok result.
// Only a config that breaks D-009 (region outside Indonesia) throws ModelNotAllowed, before any call.
final class AgentRunRecorder implements AgentRuns
{
    public function __construct(private ModelClient $client) {}

    public function call(AgentCall $call, ?callable $accept = null): AgentCallResult
    {
        $ctx = Ctx::current();
        $ctx->tenant(); // fail closed: no tenant context, no call and no row
        $model = $this->client->descriptor();
        if (! in_array($model->region, config('ai.allowed_regions'), true)) {
            // D-009 defense in depth (adapters already refuse at construction). No agent_run row: its region CHECK only
            // admits Indonesia, and no call happens. The refusal itself is audited; the caller gets a config error.
            Audit::log('ai_panggil', 'agent_run', null, ['agent' => $call->agent->value, 'outcome' => RunOutcome::Gagal->value,
                'error_code' => 'region_not_allowed', 'provider' => $model->provider, 'model_id' => $model->modelId, 'region' => $model->region]);
            throw new ModelNotAllowed('Region AI di luar Indonesia ditolak (D-009).');
        }

        $run = AgentRun::create([
            'branch_id' => $ctx->branchId,
            'agent' => $call->agent->value,
            'requested_by' => $ctx->userId,
            'patient_id' => $call->patientId,
            'cross_branch' => $call->crossBranch,
            'provider' => $model->provider,
            'model_id' => $model->modelId,
            'region' => $model->region,
            'prompt_version' => $call->promptVersion,
            'generator' => 'llm',
            'redactions' => $call->redactions,
            'input_refs' => self::refsOnly($call->inputRefs),
            'input_hash' => $call->request->sha256(),
            'outcome' => RunOutcome::Berjalan->value,
            'started_at' => now(),
        ]);

        $reply = null;
        $error = null;
        $t0 = hrtime(true);
        try {
            $reply = $this->client->complete($call->request);
        } catch (ModelUnavailable $e) {
            $error = self::code($e->reason);
        } catch (Throwable) {
            $error = 'unexpected'; // message may contain prompt fragments: never stored
        }
        $latency = intdiv(hrtime(true) - $t0, 1_000_000);

        $check = null;
        if ($reply !== null && $accept !== null) {
            $verdict = $accept($reply);
            $check = $verdict instanceof ReplyCheck ? $verdict : new ReplyCheck((bool) $verdict);
        }
        $outcome = match (true) {
            $reply === null => RunOutcome::Gagal,
            $check !== null && ! $check->accepted => RunOutcome::BerhentiMintaManusia,
            default => RunOutcome::Berhasil,
        };
        $run->update([
            'outcome' => $outcome->value,
            'error_code' => $error,
            'output_hash' => $reply ? hash('sha256', $reply->text) : null,
            'tokens_in' => $reply?->tokensIn,
            'tokens_out' => $reply?->tokensOut,
            'latency_ms' => $latency,
            'claims_total' => $check?->claimsTotal,
            'claims_dropped' => $check?->claimsDropped,
            'finished_at' => now(),
        ]);
        Audit::log('ai_panggil', 'agent_run', $run->id, array_filter([
            'agent' => $call->agent->value, 'outcome' => $outcome->value, 'error_code' => $error, 'provider' => $model->provider,
            'model_id' => $model->modelId, 'region' => $model->region, 'prompt_version' => $call->promptVersion,
            'patient_id' => $call->patientId, 'cross_branch' => $call->crossBranch ?: null, 'refs' => count($call->inputRefs),
        ], fn ($v) => $v !== null));

        return new AgentCallResult($run->id, $outcome, $outcome === RunOutcome::Berhasil ? $reply : null, $error);
    }

    public function recordDeterministic(AgentKind $agent, string $promptVersion, array $inputRefs, string $inputHash, ?string $patientId = null, bool $crossBranch = false): string
    {
        $ctx = Ctx::current();
        $ctx->tenant();
        $run = AgentRun::create([
            'branch_id' => $ctx->branchId, 'agent' => $agent->value, 'requested_by' => $ctx->userId, 'patient_id' => $patientId,
            'cross_branch' => $crossBranch, 'provider' => 'lokal', 'model_id' => 'deterministik', 'region' => 'id-lokal',
            'prompt_version' => $promptVersion, 'generator' => 'deterministik', 'input_refs' => self::refsOnly($inputRefs),
            'input_hash' => $inputHash, 'output_hash' => null, 'tokens_in' => 0, 'tokens_out' => 0, 'latency_ms' => 0,
            'outcome' => RunOutcome::Berhasil->value, 'started_at' => now(), 'finished_at' => now(),
        ]);
        Audit::log('ai_panggil', 'agent_run', $run->id, array_filter(['agent' => $agent->value, 'outcome' => RunOutcome::Berhasil->value,
            'generator' => 'deterministik', 'prompt_version' => $promptVersion, 'patient_id' => $patientId, 'cross_branch' => $crossBranch ?: null,
            'refs' => count($inputRefs)], fn ($v) => $v !== null));

        return $run->id;
    }

    /** Keep only {type, id, version} scalars so no content can slip into input_refs. */
    private static function refsOnly(array $refs): array
    {
        return array_values(array_map(fn ($r) => array_filter([
            'type' => substr((string) ($r['type'] ?? ''), 0, 40),
            'id' => substr((string) ($r['id'] ?? ''), 0, 64),
            'version' => isset($r['version']) ? (int) $r['version'] : null,
        ], fn ($v) => $v !== null), $refs));
    }

    /** Adapters must throw a short code; anything else (could be an SDK message with prompt text) collapses to `unavailable`. */
    private static function code(string $reason): string
    {
        return preg_match('/^[a-z0-9_]{1,40}$/', $reason) ? $reason : 'unavailable';
    }
}
