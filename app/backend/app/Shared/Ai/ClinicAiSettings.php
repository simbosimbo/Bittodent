<?php

namespace App\Shared\Ai;

// Per-clinic paid-AI switch shared by A1 (ICD re-pick) and A4 (KTP). Row in clinic_ai_setting for the current tenant wins;
// no row => config('ai.paid_ai.default') (env AI_PAID_ENABLED, default false). Paid AI is off unless a clinic turns it on.
final class ClinicAiSettings
{
    public function paidAiEnabled(): bool
    {
        return ClinicAiSetting::query()->value('paid_enabled') ?? (bool) config('ai.paid_ai.default');
    }
}
