<?php

namespace App\Modules\Agents;

use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Services\AgentRunRecorder;
use App\Modules\Agents\Services\DraftReviewService;
use App\Shared\ModuleServiceProvider;

// Owns agent_run + agent_draft (docs/database.md 3.9). Feature modules (summary, scribe, ICD, KTP) use Contracts\AgentRuns
// and Contracts\AgentDrafts; the model itself is reached only through Integrations\Contracts\ModelClient.
class AgentsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [AgentRuns::class => AgentRunRecorder::class, AgentDrafts::class => DraftReviewService::class];
}
