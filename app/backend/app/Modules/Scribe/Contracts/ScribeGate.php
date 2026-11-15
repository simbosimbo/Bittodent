<?php

namespace App\Modules\Scribe\Contracts;

// Paid feature: both AI_PAID_ENABLED (config ai.paid_ai.default) AND clinic_ai_setting.paid_enabled
// must be true. Both default off. Token cap is a monthly per-clinic sum of agent_run tokens.
interface ScribeGate
{
    public function paidEnabled(): bool;

    /** Tokens used this calendar month (Asia/Jakarta) by this tenant's agent_run rows. */
    public function tokensUsedThisMonth(): int;

    public function monthlyTokenCap(): int;

    public function remainingTokens(): int;

    /** True when used + $additional would exceed the cap. */
    public function wouldExceedCap(int $additional = 0): bool;
}
