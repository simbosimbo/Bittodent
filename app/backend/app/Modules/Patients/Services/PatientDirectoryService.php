<?php

namespace App\Modules\Patients\Services;

use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Patients\Models\Guardian;
use App\Modules\Patients\Models\Patient;
use App\Shared\Crypto\Crypto;
use Illuminate\Support\Arr;

final class PatientDirectoryService implements PatientDirectory
{
    public function assertExists(string $patientId): void
    {
        Patient::findOrFail($patientId, ['tenant_id', 'id']);
    }

    public function summary(string $patientId): array
    {
        $p = Patient::findOrFail($patientId);

        return [...Arr::only($p->toArray(), ['id', 'name', 'dob', 'sex', 'payer_type']), 'is_minor' => $p->isMinor()]; // toArray: dob as Y-m-d
    }

    public function payerOf(string $patientId): string
    {
        $p = Patient::findOrFail($patientId, ['tenant_id', 'id', 'guarantor_id']);

        return $p->guarantor_id ?? $p->id;
    }

    public function nik(string $patientId): ?string
    {
        return Crypto::decrypt(Patient::findOrFail($patientId, ['tenant_id', 'id', 'nik_enc'])->nik_enc);
    }

    public function guardianBelongsTo(string $guardianId, string $patientId): bool
    {
        return Guardian::where('patient_id', $patientId)->whereKey($guardianId)->exists();
    }

    public function namesByIds(array $ids): array
    {
        return Patient::whereIn('id', $ids)->get(['tenant_id', 'id', 'name'])->toArray();
    }
}
