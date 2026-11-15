<?php

namespace App\Modules\Integrations\Contracts;

final readonly class ModelReply
{
    public function __construct(
        public string $text,     // raw, untrusted (validate before use, e.g. App\Shared\Ai\CitationValidator)
        public int $tokensIn,
        public int $tokensOut,
    ) {}
}
