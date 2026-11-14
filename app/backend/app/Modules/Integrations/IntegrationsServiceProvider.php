<?php

namespace App\Modules\Integrations;

use App\Modules\Integrations\Contracts\OutboxPublisher;
use App\Modules\Integrations\Services\OutboxService;
use App\Shared\ModuleServiceProvider;

// Owns the `outbox` table (SATUSEHAT/WhatsApp sends). No sender yet.
class IntegrationsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [OutboxPublisher::class => OutboxService::class];
}
