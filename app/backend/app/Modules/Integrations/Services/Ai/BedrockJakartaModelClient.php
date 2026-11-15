<?php

namespace App\Modules\Integrations\Services\Ai;

use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelDescriptor;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Contracts\ModelUnavailable;

// Skeleton for Amazon Bedrock Jakarta (D-009): region ap-southeast-3 and an IN-REGION model ID only.
// A0.1: ALLOWLIST, not a prefix blocklist. The model ID must equal one entry of config('ai.allowed_model_ids') exactly
// (source: docs/ai/arsitektur-ai.md, PR #56). Everything else is refused at construction, so a bad config fails at boot,
// not at the first patient: every cross-region inference profile (us., eu., apac., global., ca., us-gov., jp., ...),
// any ARN (foundation-model or inference-profile), other casing or surrounding spaces. complete() is not wired to AWS
// yet (no SDK, no credentials, stays off until the D-030 real-data gate): it always throws not_configured.
final class BedrockJakartaModelClient implements ModelClient
{
    public const REGION = 'ap-southeast-3';

    /** @param list<string>|null $allowedModelIds null = config('ai.allowed_model_ids') */
    public function __construct(private string $region, private string $modelId, ?array $allowedModelIds = null)
    {
        self::assertAllowed($region, $modelId, $allowedModelIds);
    }

    /** @param list<string>|null $allowedModelIds */
    public static function assertAllowed(string $region, string $modelId, ?array $allowedModelIds = null): void
    {
        if ($region !== self::REGION) {
            throw new ModelNotAllowed('Region AI harus '.self::REGION." (D-009), bukan '$region'.");
        }
        if ($modelId === '') {
            throw new ModelNotAllowed('Model ID Bedrock belum di-set.');
        }
        $allowed = $allowedModelIds ?? (array) config('ai.allowed_model_ids', []);
        if (! in_array($modelId, $allowed, true)) {
            throw new ModelNotAllowed('Model ID Bedrock tidak ada di daftar izin (config/ai.php allowed_model_ids). '
                .'Profil inferensi lintas region dan ARN tidak diizinkan (D-009).');
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
