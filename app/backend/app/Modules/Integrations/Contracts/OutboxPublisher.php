<?php

namespace App\Modules\Integrations\Contracts;

interface OutboxPublisher
{
    /** Queue an outbound send in the caller's transaction. Same key twice = one row (idempotent). Payload: ids only, no clinical text. */
    public function enqueue(string $kind, string $idempotencyKey, array $payload): void;
}
