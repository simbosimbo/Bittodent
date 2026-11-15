<?php

namespace App\Modules\Integrations\Contracts;

final readonly class ModelDescriptor
{
    public function __construct(
        public string $provider,  // fake | bedrock | self_hosted
        public string $modelId,
        public string $region,    // ap-southeast-3 | id-lokal (in-process / self-hosted in Indonesia)
    ) {}
}
