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
}
