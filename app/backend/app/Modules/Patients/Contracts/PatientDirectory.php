<?php

namespace App\Modules\Patients\Contracts;

interface PatientDirectory
{
    /** Throws ModelNotFoundException (404) when the patient is not in the current tenant. */
    public function assertExists(string $patientId): void;

    /** Chart header. 404 when not in the current tenant. @return array{id: string, name: string, dob: ?string, sex: ?string, payer_type: string, is_minor: bool} */
    public function summary(string $patientId): array;

    /** Who pays this patient's bills: the guarantor (penanggung biaya) or the patient themself. 404 when not in this tenant. */
    public function payerOf(string $patientId): string;

    /** Decrypted NIK (memory only; never log or audit it). 404 when not in the current tenant. */
    public function nik(string $patientId): ?string;

    public function guardianBelongsTo(string $guardianId, string $patientId): bool;

    /** @param list<string> $ids  @return list<array{tenant_id: string, id: string, name: string}> */
    public function namesByIds(array $ids): array;
}
