<?php

namespace App\Modules\Integrations\Services;

use App\Modules\Integrations\Contracts\OutboxPublisher;
use App\Modules\Integrations\Models\Outbox;
use App\Shared\Crypto\Crypto;

// TODO SATUSEHAT: no sender/adapter yet (no-op); rows stay `pending` until a worker exists.
final class OutboxService implements OutboxPublisher
{
    public function enqueue(string $kind, string $idempotencyKey, array $payload): void
    {
        Outbox::firstOrCreate(['idempotency_key' => $idempotencyKey], ['kind' => $kind, 'payload_enc' => Crypto::encrypt(json_encode($payload))]);
    }
}
