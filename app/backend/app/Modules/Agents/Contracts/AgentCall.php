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
        public bool $crossBranch = false,   // D-027: reading another branch's data (audited)
        public ?int $redactions = null,     // PII replacements made before sending (count only)
    ) {}

    /** For feature modules without an Integrations edge: builds the ModelRequest here. */
    public static function prompt(AgentKind $agent, string $promptVersion, string $system, string $input, int $maxOutputTokens, float $temperature,
        array $inputRefs = [], ?string $patientId = null, ?int $redactions = null): self
    {
        return new self($agent, $promptVersion, new ModelRequest($system, $input, $maxOutputTokens, $temperature), $inputRefs, $patientId, redactions: $redactions);
    }
}
