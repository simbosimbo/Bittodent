<?php

namespace App\Modules\Scribe;

use App\Modules\Scribe\Contracts\AudioStore;
use App\Modules\Scribe\Contracts\ScribeEngine;
use App\Modules\Scribe\Contracts\ScribeGate;
use App\Modules\Scribe\Contracts\SpeechToText;
use App\Modules\Scribe\Services\ConfigClinicScribeGate;
use App\Modules\Scribe\Services\EncryptedFileAudioStore;
use App\Modules\Scribe\Services\FakeSpeechToText;
use App\Modules\Scribe\Services\NotConfiguredSpeechToText;
use App\Modules\Scribe\Services\ScribeEngineService;
use App\Shared\ModuleServiceProvider;

// A3 scribe: doctor's dictation aid (D-048). Default STT is not_configured (no in-region ASR in ap-southeast-3).
class ScribeServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [
        AudioStore::class => EncryptedFileAudioStore::class,
        ScribeGate::class => ConfigClinicScribeGate::class,
        ScribeEngine::class => ScribeEngineService::class,
    ];

    public function register(): void
    {
        parent::register();
        $this->app->bind(SpeechToText::class, fn () => config('ai.driver') === 'fake'
            ? $this->app->make(FakeSpeechToText::class)
            : $this->app->make(NotConfiguredSpeechToText::class));
    }
}
