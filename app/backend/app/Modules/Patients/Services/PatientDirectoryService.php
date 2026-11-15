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

    public function redactionTerms(string $patientId): array
    {
        $p = Patient::findOrFail($patientId);
        $people = [[$p->name, $p->nik_enc, $p->phone_enc, $p->address_enc]];
        foreach (Guardian::where('patient_id', $patientId)->get() as $g) {
            $people[] = [$g->name, $g->nik_enc, $g->phone_enc, null];
        }
        $terms = [];
        foreach ($people as [$name, $nik, $phone, $address]) {
            $phone = Crypto::decrypt($phone);
            $terms = [...$terms, $name, Crypto::decrypt($nik), $phone, $phone && str_starts_with($phone, '62') ? '0'.substr($phone, 2) : null,
                Crypto::decrypt($address)];
            foreach (preg_split('/\s+/', (string) $name) as $part) { // single name parts ("Sari") too, if long enough to be specific
                $terms[] = mb_strlen($part) >= 4 ? $part : null;
            }
        }

        return array_values(array_unique(array_filter($terms, fn ($t) => is_string($t) && trim($t) !== '')));
    }

    public function namesByIds(array $ids): array
    {
        return Patient::whereIn('id', $ids)->get(['tenant_id', 'id', 'name'])->toArray();
    }
}
