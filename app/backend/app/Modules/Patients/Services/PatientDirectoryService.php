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

    public function guardianBelongsTo(string $guardianId, string $patientId): bool
    {
        return Guardian::where('patient_id', $patientId)->whereKey($guardianId)->exists();
    }

    public function namesByIds(array $ids): array
    {
        return Patient::whereIn('id', $ids)->get(['tenant_id', 'id', 'name'])->toArray();
    }

    public function findOrCreateForBooking(string $name, string $phone, string $branchId): string
    {
        $found = Patient::where('phone_bidx', Crypto::blindIndex(Crypto::normalizePhone($phone)))
            ->where('name_normalized', Patient::normalizeName($name))->orderBy('created_at')->value('id');
        if ($found) {
            return $found;
        }
        $p = (new Patient)->fillIdentity(['name' => $name, 'phone' => $phone])->fill(['home_branch_id' => $branchId, 'source' => 'online']);
        $p->save();

        return $p->id;
    }
}
