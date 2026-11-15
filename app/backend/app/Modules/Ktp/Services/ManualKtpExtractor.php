<?php

namespace App\Modules\Ktp\Services;

use App\Modules\Ktp\Contracts\KtpExtraction;
use App\Modules\Ktp\Contracts\KtpExtractor;
use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\KtpPhoto;
use App\Modules\Ktp\Contracts\NikValidator;

// FINAL default: typed fields + deterministic NIK check. No model, no agent_run, no draft; the photo is ignored.
final class ManualKtpExtractor implements KtpExtractor
{
    public function __construct(private NikValidator $validator) {}

    public function extract(KtpInput $input, ?KtpPhoto $photo = null): KtpExtraction
    {
        return new KtpExtraction($input, $this->validator->check($input), 'manual');
    }
}
