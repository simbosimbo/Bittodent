<?php

namespace App\Modules\Ktp;

use App\Modules\Ktp\Contracts\ClinicAiSettings;
use App\Modules\Ktp\Contracts\KtpExtractor;
use App\Modules\Ktp\Contracts\KtpPhotoStore;
use App\Modules\Ktp\Contracts\NikValidator;
use App\Modules\Ktp\Domain\NikParser;
use App\Modules\Ktp\Services\BedrockNovaLiteKtpExtractor;
use App\Modules\Ktp\Services\ConfigClinicAiSettings;
use App\Modules\Ktp\Services\EncryptedKtpPhotoStore;
use App\Modules\Ktp\Services\ManualKtpExtractor;
use App\Shared\ModuleServiceProvider;

// A4 KTP. FINAL (15 Nov 2026): manual entry + NIK checks; Nova Lite only when ai.ktp.extractor=nova_lite AND the clinic's
// paid switch is on (both off by default). Nova re-checks the switch itself.
class KtpServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [
        NikValidator::class => NikParser::class,
        ClinicAiSettings::class => ConfigClinicAiSettings::class,
        KtpPhotoStore::class => EncryptedKtpPhotoStore::class,
    ];

    public function register(): void
    {
        $this->app->bind(KtpExtractor::class, fn ($app) => config('ai.ktp.extractor') === 'nova_lite' && $app->make(ClinicAiSettings::class)->paidAiEnabled()
            ? $app->make(BedrockNovaLiteKtpExtractor::class) : $app->make(ManualKtpExtractor::class));
    }
}
