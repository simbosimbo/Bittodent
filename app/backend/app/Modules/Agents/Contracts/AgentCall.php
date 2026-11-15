<?php

namespace App\Modules\Agents\Contracts;

use App\Modules\Integrations\Contracts\ModelRequest;

final readonly class AgentCall
{
    /** @param list<array{type: string, id: string, version?: int}> $inputRefs references to what was read (ids), never copies */
    public function __construct(
        public AgentKind $agent,
        public string $promptVersion,
        public ModelRequest $request,
        public array $inputRefs = [],
        public ?string $patientId = null,
    ) {}
}
