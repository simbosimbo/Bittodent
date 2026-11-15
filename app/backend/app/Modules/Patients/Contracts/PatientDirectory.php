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

    public function guardianBelongsTo(string $guardianId, string $patientId): bool;

    /**
     * Identifying strings of the patient and their guardians (name, NIK, phone in local + 62 form, address), decrypted, for
     * scrubbing free text before it reaches a model. Keep in memory only; never log or return to a client. 404 when not in this tenant.
     *
     * @return list<string>
     */
    public function redactionTerms(string $patientId): array;

    /** @param list<string> $ids  @return list<array{tenant_id: string, id: string, name: string}> */
    public function namesByIds(array $ids): array;
}
