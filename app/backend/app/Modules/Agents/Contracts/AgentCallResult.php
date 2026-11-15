<?php

namespace App\Modules\Agents\Contracts;

use App\Modules\Integrations\Contracts\ModelReply;

final readonly class AgentCallResult
{
    public function __construct(
        public string $runId,
        public RunOutcome $outcome,
        public ?ModelReply $reply = null,   // null unless outcome = berhasil
        public ?string $errorCode = null,
    ) {}

    public function ok(): bool
    {
        return $this->outcome === RunOutcome::Berhasil;
    }
}
