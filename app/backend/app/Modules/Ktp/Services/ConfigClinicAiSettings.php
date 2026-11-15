<?php

namespace App\Modules\Ktp\Services;

use App\Modules\Ktp\Contracts\ClinicAiSettings;
use App\Modules\Ktp\Models\ClinicAiSetting;

// clinic_ai_setting row for the current tenant wins; no row => config('ai.paid_ai.default') (FINAL: off).
final class ConfigClinicAiSettings implements ClinicAiSettings
{
    public function paidAiEnabled(): bool
    {
        return ClinicAiSetting::query()->value('paid_enabled') ?? (bool) config('ai.paid_ai.default');
    }
}
