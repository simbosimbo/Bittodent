<?php

namespace App\Modules\Scribe\Contracts;

use RuntimeException;

// Thrown when no in-region speech-to-text driver is configured. Reason code only — never paths or text.
final class SpeechToTextUnavailable extends RuntimeException
{
    public function __construct(public string $reason = 'not_configured')
    {
        parent::__construct($reason);
    }
}
