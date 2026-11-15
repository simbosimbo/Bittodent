<?php

namespace App\Modules\Integrations\Services\Ai;

use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelDescriptor;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Contracts\ModelUnavailable;

// Skeleton for Amazon Bedrock Jakarta (D-009): region ap-southeast-3 and an IN-REGION model ID only.
// Cross-region inference profiles (Geo/Global, model IDs prefixed us./eu./apac./global. or an inference-profile ARN)
// are refused at construction, so a bad config fails at boot, not at the first patient. complete() is not wired to
// AWS yet (no SDK, no credentials, stays off until the D-030 real-data gate): it always throws not_configured.
final class BedrockJakartaModelClient implements ModelClient
{
    public const REGION = 'ap-southeast-3';

    // Inference profile prefixes named in the task/D-009. Other geo prefixes AWS may add: perlu dicek before go-live.
    public const FORBIDDEN_PREFIXES = ['us.', 'eu.', 'apac.', 'global.'];

    public function __construct(private string $region, private string $modelId)
    {
        self::assertAllowed($region, $modelId);
    }

    public static function assertAllowed(string $region, string $modelId): void
    {
        if ($region !== self::REGION) {
            throw new ModelNotAllowed('Region AI harus '.self::REGION." (D-009), bukan '$region'.");
        }
        $id = strtolower(trim($modelId));
        if ($id === '') {
            throw new ModelNotAllowed('Model ID Bedrock belum di-set.');
        }
        foreach (self::FORBIDDEN_PREFIXES as $prefix) {
            if (str_starts_with($id, $prefix)) {
                throw new ModelNotAllowed("Profil inferensi lintas region ('$prefix') dilarang (D-009). Pakai model ID in-region.");
            }
        }
        if (str_starts_with($id, 'arn:') && ! str_contains($id, ':'.self::REGION.':')) {
            throw new ModelNotAllowed('ARN model harus di region '.self::REGION.' (D-009).');
        }
        if (str_contains($id, 'inference-profile/')) {
            throw new ModelNotAllowed('ARN profil inferensi dilarang (D-009). Pakai model ID in-region.');
        }
    }

    public function descriptor(): ModelDescriptor
    {
        return new ModelDescriptor('bedrock', $this->modelId, $this->region);
    }

    public function complete(ModelRequest $request): ModelReply
    {
        // TODO(A-bedrock): bedrock-runtime Converse at https://bedrock-runtime.ap-southeast-3.amazonaws.com, timeout,
        // no request/response logging, SDK errors mapped to short reason codes.
        throw new ModelUnavailable('not_configured');
    }
}
