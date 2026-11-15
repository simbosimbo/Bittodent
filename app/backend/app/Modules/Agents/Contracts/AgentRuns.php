<?php

namespace App\Modules\Agents\Contracts;

use App\Modules\Integrations\Contracts\ModelReply;

// The only way feature code calls a model. Per call: one agent_run row (written before the call, completed once after),
// one audit_event `ai_panggil`, for success and failure alike. Needs a tenant context (fails closed without one).
// Stores hashes, token counts, latency and reference ids only: never prompt, reply or clinical text.
interface AgentRuns
{
    /**
     * $accept: optional reply check. Not accepted => outcome berhenti_minta_manusia (reply failed validation;
     * a person or the deterministic fallback takes over).
     *
     * @param  (callable(ModelReply): (bool|ReplyCheck))|null  $accept
     */
    public function call(AgentCall $call, ?callable $accept = null): AgentCallResult;

    /**
     * A result built without any model (deterministic rules). Still one completed agent_run (generator deterministik,
     * region id-lokal) + one audit row, so every AI-labelled output has a run. @param list<array{type: string, id: string, version?: int}> $inputRefs
     */
    public function recordDeterministic(AgentKind $agent, string $promptVersion, array $inputRefs, string $inputHash, ?string $patientId = null, bool $crossBranch = false): string;

    /** Sum of tokens_in + tokens_out for this tenant in the current calendar month (Asia/Jakarta). */
    public function tokensUsedThisMonth(): int;
}
