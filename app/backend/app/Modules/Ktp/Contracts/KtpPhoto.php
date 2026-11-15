<?php

namespace App\Modules\Ktp\Contracts;

/** Metadata only. Ciphertext never leaves the store; bytes are not in this DTO. */
final readonly class KtpPhoto
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public ?string $patientId,
        public string $mime,
    ) {}
}
