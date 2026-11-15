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
            'region Singapura' => ['ap-southeast-1', 'amazon.nova-lite-v1:0'],
            'region US' => ['us-east-1', 'amazon.nova-lite-v1:0'],
            'region kosong' => ['', 'amazon.nova-lite-v1:0'],
            'profil us.' => ['ap-southeast-3', 'us.amazon.nova-lite-v1:0'],
            'profil eu.' => ['ap-southeast-3', 'eu.amazon.nova-lite-v1:0'],
            'profil apac.' => ['ap-southeast-3', 'apac.amazon.nova-lite-v1:0'],
            'profil global.' => ['ap-southeast-3', 'global.amazon.nova-lite-v1:0'],
            'profil GLOBAL. huruf besar' => ['ap-southeast-3', 'GLOBAL.amazon.nova-lite-v1:0'],
            'ARN profil inferensi' => ['ap-southeast-3', 'arn:aws:bedrock:ap-southeast-3:000000000000:inference-profile/apac.contoh'],
            'ARN region lain' => ['ap-southeast-3', 'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0'],
            'model kosong' => ['ap-southeast-3', ''],
        ];
    }

    #[DataProvider('forbiddenConfigs')]
    public function test_bedrock_refuses_non_jakarta_or_cross_region_profiles(string $region, string $modelId): void
    {
        $this->expectException(ModelNotAllowed::class);
        new BedrockJakartaModelClient($region, $modelId);
    }

    public function test_bedrock_in_region_model_is_accepted_but_never_calls_aws_yet(): void
    {
        $client = new BedrockJakartaModelClient('ap-southeast-3', 'amazon.nova-lite-v1:0');
        $this->assertSame('ap-southeast-3', $client->descriptor()->region);
        try {
            $client->complete(new ModelRequest('sistem', '{}'));
            $this->fail('expected not_configured');
        } catch (ModelUnavailable $e) {
            $this->assertSame('not_configured', $e->reason);
        }
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
