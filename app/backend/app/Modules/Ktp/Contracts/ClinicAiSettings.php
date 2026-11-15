<?php

namespace App\Modules\Ktp\Contracts;

/**
 * Per-clinic paid-AI switch. FINAL (Yohanes, 15 Nov 2026, 22:07 WIB): OFF by default.
 * Config-driven (config/ai.php paid_ai.default + optional clinic_ai_setting.paid_enabled override)
 * so it stays easy to flip without a code change.
 */
interface ClinicAiSettings
{
    public function paidAiEnabled(): bool;
}
