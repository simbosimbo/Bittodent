<?php

namespace App\Modules\Ktp\Contracts;

/** Proposed fields + the deterministic check. Always a draft until a receptionist confirms and saves. */
final readonly class KtpExtraction
{
    public function __construct(
        public KtpInput $proposed,
        public NikCheck $check,
        public string $source,          // manual | nova_lite
        public ?string $draftId = null,
        public ?string $runId = null,
    ) {}
}
