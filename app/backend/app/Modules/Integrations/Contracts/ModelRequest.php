<?php

namespace App\Modules\Integrations\Contracts;

// What is sent to the model. Build it from the minimum de-identified data the feature needs; it is hashed into
// agent_run.input_hash and never stored or logged as text.
final readonly class ModelRequest
{
    public function __construct(
        public string $system,
        public string $input,               // usually JSON built by the feature
        public int $maxOutputTokens = 1024,
        public float $temperature = 0.0,
    ) {}

    public function sha256(): string
    {
        return hash('sha256', json_encode([$this->system, $this->input, $this->maxOutputTokens, $this->temperature], JSON_THROW_ON_ERROR));
    }
}
