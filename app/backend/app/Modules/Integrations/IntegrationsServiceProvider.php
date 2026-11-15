<?php

namespace App\Modules\Integrations;

use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelNotAllowed;
use App\Modules\Integrations\Contracts\OutboxPublisher;
use App\Modules\Integrations\Services\Ai\BedrockJakartaModelClient;
use App\Modules\Integrations\Services\Ai\FakeModelClient;
use App\Modules\Integrations\Services\OutboxService;
use App\Shared\ModuleServiceProvider;

// Owns the `outbox` table (SATUSEHAT/WhatsApp sends, no sender yet) and the AI model adapters (config/ai.php).
class IntegrationsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [OutboxPublisher::class => OutboxService::class];

    public function register(): void
    {
        $this->app->bind(ModelClient::class, fn () => match (config('ai.driver')) {
            'fake' => new FakeModelClient,
            'bedrock' => new BedrockJakartaModelClient((string) config('ai.bedrock.region'), (string) config('ai.bedrock.model_id')),
            default => throw new ModelNotAllowed('ai.driver tidak dikenal.'),
        });
    }
}
