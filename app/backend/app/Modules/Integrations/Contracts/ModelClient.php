<?php

namespace App\Modules\Integrations\Contracts;

// Adapter seam for every AI model call (D-009: provider never hardcoded). Implementations: FakeModelClient (tests/demo),
// BedrockJakartaModelClient (ap-southeast-3, in-region model IDs only). Callers never call this directly for clinical work:
// they go through the Agents module (AgentRuns contract), which writes agent_run + audit for every call.
interface ModelClient
{
    /** provider/model/region written to agent_run. region must be in config('ai.allowed_regions'). */
    public function descriptor(): ModelDescriptor;

    /**
     * Raw model output, not trusted yet. Must not write to the database and must not log the request or reply.
     *
     * @throws ModelUnavailable network, timeout, quota, not configured (reason code only, never prompt text)
     */
    public function complete(ModelRequest $request): ModelReply;
}
