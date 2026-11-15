<?php

namespace App\Modules\Agents\Contracts;

// The only way feature code calls a model. Per call: one agent_run row (written before the call, completed once after),
// one audit_event `ai_panggil`, for success and failure alike. Needs a tenant context (fails closed without one).
// Stores hashes, token counts, latency and reference ids only: never prompt, reply or clinical text.
interface AgentRuns
{
    /**
     * @param  (callable(\App\Modules\Integrations\Contracts\ModelReply): bool)|null  $accept  false => outcome berhenti_minta_manusia
     *                                                                                        (reply failed validation; a person must take over)
     */
    public function call(AgentCall $call, ?callable $accept = null): AgentCallResult;
}
