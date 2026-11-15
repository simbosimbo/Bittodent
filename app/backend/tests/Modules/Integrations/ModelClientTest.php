<?php

namespace Tests\Modules\Integrations;

use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Integrations\Contracts\ModelUnavailable;
use App\Modules\Integrations\Services\Ai\BedrockJakartaModelClient;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// D-009: Bedrock only in ap-southeast-3 with in-region model IDs. No AWS call anywhere in tests.
class ModelClientTest extends TestCase
{
    public static function forbiddenConfigs(): array
    {
        return [
            'region Singapura' => ['ap-southeast-1', 'qwen.qwen3-32b-v1:0'],
            'region US' => ['us-east-1', 'qwen.qwen3-32b-v1:0'],
            'region kosong' => ['', 'qwen.qwen3-32b-v1:0'],
            'profil us.' => ['ap-southeast-3', 'us.qwen.qwen3-32b-v1:0'],
            'profil eu.' => ['ap-southeast-3', 'eu.qwen.qwen3-32b-v1:0'],
            'profil apac.' => ['ap-southeast-3', 'apac.qwen.qwen3-32b-v1:0'],
            'profil global.' => ['ap-southeast-3', 'global.qwen.qwen3-32b-v1:0'],
            'profil ca.' => ['ap-southeast-3', 'ca.qwen.qwen3-32b-v1:0'],
            'profil us-gov.' => ['ap-southeast-3', 'us-gov.qwen.qwen3-32b-v1:0'],
            'profil jp.' => ['ap-southeast-3', 'jp.qwen.qwen3-32b-v1:0'],
            'profil au.' => ['ap-southeast-3', 'au.deepseek.v3.2'],
            'ARN profil inferensi' => ['ap-southeast-3', 'arn:aws:bedrock:ap-southeast-3:000000000000:inference-profile/apac.contoh'],
            'ARN foundation-model Jakarta' => ['ap-southeast-3', 'arn:aws:bedrock:ap-southeast-3::foundation-model/qwen.qwen3-32b-v1:0'],
            'ARN region lain' => ['ap-southeast-3', 'arn:aws:bedrock:us-east-1::foundation-model/qwen.qwen3-32b-v1:0'],
            'model lain in-region' => ['ap-southeast-3', 'amazon.nova-lite-v1:0'],
            'huruf besar' => ['ap-southeast-3', 'QWEN.QWEN3-32B-V1:0'],
            'spasi' => ['ap-southeast-3', ' qwen.qwen3-32b-v1:0'],
            'versi lain' => ['ap-southeast-3', 'qwen.qwen3-32b-v2:0'],
            'model kosong' => ['ap-southeast-3', ''],
        ];
    }

    #[DataProvider('forbiddenConfigs')]
    public function test_bedrock_refuses_anything_outside_jakarta_and_the_exact_allowlist(string $region, string $modelId): void
    {
        $this->expectException(ModelNotAllowed::class);
        new BedrockJakartaModelClient($region, $modelId);
    }

    public static function allowedIds(): array
    {
        return [['qwen.qwen3-235b-a22b-2507-v1:0'], ['qwen.qwen3-32b-v1:0'], ['deepseek.v3.2'], ['openai.gpt-oss-120b-1:0']];
    }

    #[DataProvider('allowedIds')]
    public function test_every_allowlisted_id_is_accepted_but_never_calls_aws_yet(string $id): void
    {
        $this->assertSame([$id], array_values(array_filter(config('ai.allowed_model_ids'), fn ($x) => $x === $id)));
        $client = new BedrockJakartaModelClient('ap-southeast-3', $id);
        $this->assertSame(['bedrock', $id, 'ap-southeast-3'], [$client->descriptor()->provider, $client->descriptor()->modelId, $client->descriptor()->region]);
        try {
            $client->complete(new ModelRequest('sistem', '{}'));
            $this->fail('expected not_configured');
        } catch (ModelUnavailable $e) {
            $this->assertSame('not_configured', $e->reason);
        }
    }

    public function test_allowlist_comes_from_config_and_an_empty_list_allows_nothing(): void
    {
        config(['ai.allowed_model_ids' => []]);
        try {
            new BedrockJakartaModelClient('ap-southeast-3', 'qwen.qwen3-32b-v1:0');
            $this->fail('empty allowlist accepted a model');
        } catch (ModelNotAllowed) {
        }
        config(['ai.allowed_model_ids' => ['contoh.model-uji-v1:0']]);
        $this->assertSame('contoh.model-uji-v1:0', (new BedrockJakartaModelClient('ap-southeast-3', 'contoh.model-uji-v1:0'))->descriptor()->modelId);
        $this->expectException(ModelNotAllowed::class);
        new BedrockJakartaModelClient('ap-southeast-3', 'qwen.qwen3-32b-v1:0', ['lain']);
    }

    public function test_container_binds_fake_by_default_and_rejects_bad_bedrock_config_at_resolve(): void
    {
        $this->assertInstanceOf(FakeModelClient::class, app(ModelClient::class));
        config(['ai.driver' => 'bedrock', 'ai.bedrock.region' => 'ap-southeast-3', 'ai.bedrock.model_id' => 'global.contoh-model']);
        $this->expectException(ModelNotAllowed::class);
        app(ModelClient::class);
    }

    public function test_fake_is_deterministic_and_scriptable(): void
    {
        $req = new ModelRequest('sistem', '{"n":1}');
        $this->assertEquals((new FakeModelClient)->complete($req), (new FakeModelClient)->complete($req));
        $this->assertNotEquals((new FakeModelClient)->complete($req)->text, (new FakeModelClient)->complete(new ModelRequest('sistem', '{"n":2}'))->text);

        $fake = (new FakeModelClient)->willReply('{"a":1}')->willFail('timeout');
        $this->assertSame('{"a":1}', $fake->complete($req)->text);
        $this->expectExceptionObject(new ModelUnavailable('timeout'));
        $fake->complete($req);
    }
}
