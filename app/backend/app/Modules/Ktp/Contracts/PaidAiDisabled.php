<?php

namespace App\Modules\Ktp\Contracts;

/** Thrown when a paid extractor is invoked while the per-clinic switch is off. */
final class PaidAiDisabled extends \RuntimeException
{
    public function __construct(string $message = 'AI berbayar untuk klinik ini mati.')
    {
        parent::__construct($message);
    }
}
