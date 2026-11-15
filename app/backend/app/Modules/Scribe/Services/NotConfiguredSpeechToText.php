<?php

namespace App\Modules\Scribe\Services;

use App\Modules\Scribe\Contracts\SpeechToText;
use App\Modules\Scribe\Contracts\SpeechToTextUnavailable;
use App\Modules\Scribe\Contracts\Transcript;

// Production default: no in-region ASR exists in ap-southeast-3 (Voxtral not on the official matrix; Transcribe has no Jakarta endpoint).
final class NotConfiguredSpeechToText implements SpeechToText
{
    public function transcribe(string $absolutePath, string $mime, int $durationSec): Transcript
    {
        throw new SpeechToTextUnavailable('not_configured');
    }
}
