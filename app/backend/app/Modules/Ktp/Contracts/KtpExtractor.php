<?php

namespace App\Modules\Ktp\Contracts;

/**
 * How KTP fields are obtained. Default (FINAL, 15 Nov 2026): ManualKtpExtractor — typed fields + NikValidator.
 * BedrockNovaLiteKtpExtractor is a skeleton behind the per-clinic paid-AI switch (FINAL: OFF by default)
 * and may only call a model via AgentRuns::call (audit ai_panggil). Results are drafts until verified.
 */
interface KtpExtractor
{
    /** $photo is ignored by the manual extractor and must not be sent to a model when the paid switch is off. */
    public function extract(KtpInput $input, ?KtpPhoto $photo = null): KtpExtraction;
}
