<?php

namespace App\Modules\Scribe\Services;

use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Scribe\Contracts\ScribeGate;
use App\Shared\Ai\ClinicAiSetting;

// Scribe-specific AND of the global kill switch and the per-clinic row (both default off).
// This is stricter than ClinicAiSettings::paidAiEnabled() used by A1/A4 (row overrides env).
final class ConfigClinicScribeGate implements ScribeGate
{
    public function __construct(private AgentRuns $runs) {}

    public function paidEnabled(): bool
    {
        return (bool) config('ai.paid_ai.default') && (bool) (ClinicAiSetting::query()->value('paid_enabled') ?? false);
    }

    public function tokensUsedThisMonth(): int
    {
        return $this->runs->tokensUsedThisMonth();
    }

    public function monthlyTokenCap(): int
    {
        $row = ClinicAiSetting::query()->value('monthly_token_cap');

        return $row !== null ? (int) $row : (int) config('ai.paid_ai.monthly_token_cap', 200000);
    }

    public function remainingTokens(): int
    {
        return max(0, $this->monthlyTokenCap() - $this->tokensUsedThisMonth());
    }

    public function wouldExceedCap(int $additional = 0): bool
    {
        return ($this->tokensUsedThisMonth() + $additional) >= $this->monthlyTokenCap();
    }
}
