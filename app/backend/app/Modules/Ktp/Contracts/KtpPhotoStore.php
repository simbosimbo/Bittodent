<?php

namespace App\Modules\Ktp\Contracts;

/** Encrypted, tenant-scoped KTP photo. Other tenants get null (controller maps to 404). */
interface KtpPhotoStore
{
    /** @param string $bytes raw image bytes (encrypted at rest by the implementation) */
    public function store(?string $patientId, string $bytes, string $mime): KtpPhoto;

    public function get(string $id): ?KtpPhoto;

    /** Raw decrypted bytes for an unmasked view (patient.ktp.view). Never log. */
    public function bytes(string $id): ?string;

    public function attachToPatient(string $id, string $patientId): void;
}
