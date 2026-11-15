<?php

namespace App\Modules\Agents\Contracts;

// Optional richer answer from the $accept callback of AgentRuns::call (e.g. after App\Shared\Ai\CitationValidator).
// Counts only, no text: they go to agent_run.claims_total / claims_dropped.
final readonly class ReplyCheck
{
    public function __construct(
        public bool $accepted,
        public ?int $claimsTotal = null,
        public ?int $claimsDropped = null,
    ) {}
}
