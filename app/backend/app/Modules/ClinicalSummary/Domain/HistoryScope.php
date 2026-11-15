<?php

namespace App\Modules\ClinicalSummary\Domain;

use InvalidArgumentException;

// What is read. Hard limits on the server, not trusted from the client.
final readonly class HistoryScope
{
    public function __construct(
        public int $months = 24,
        public int $maxVisits = 20,
        public int $maxCharsPerNote = 2000,
    ) {
        if ($months < 1 || $months > 60 || $maxVisits < 1 || $maxVisits > 40 || $maxCharsPerNote < 100 || $maxCharsPerNote > 4000) {
            throw new InvalidArgumentException('HistoryScope di luar batas.');
        }
    }
}
