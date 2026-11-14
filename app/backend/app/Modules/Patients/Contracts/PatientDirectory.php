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

    /** @param list<string> $ids  @return list<array{tenant_id: string, id: string, name: string}> */
    public function namesByIds(array $ids): array;

    /**
     * Online booking: the patient with this phone (blind index) AND this name in the current tenant, else a new minimal patient
     * (source=online). Phone alone is not enough: families share one WhatsApp number. Returns the patient id.
     */
    public function findOrCreateForBooking(string $name, string $phone, string $branchId): string;
}
