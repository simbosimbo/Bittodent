<?php

namespace App\Modules\Patients\Services;

use App\Modules\Patients\Contracts\MedicalHistoryReader;
use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Patients\Models\Patient;
use App\Shared\Crypto\Crypto;

final class MedicalHistoryReaderService implements MedicalHistoryReader
{
    public function current(string $patientId): ?array
    {
        Patient::findOrFail($patientId, ['tenant_id', 'id']);
        $v = MedicalHistoryVersion::where('patient_id', $patientId)->orderByDesc('version')->first();
        if ($v === null) {
            return null;
        }
        $c = json_decode(Crypto::decrypt($v->content_enc), true) ?? [];
        $list = fn ($x) => array_values(array_filter(array_map('strval', (array) ($x ?? [])), fn ($s) => trim($s) !== ''));

        return ['id' => $v->id, 'version' => (int) $v->version, 'allergies' => $list($c['allergies'] ?? []), 'medications' => $list($c['medications'] ?? []),
            'problems' => $list($c['problems'] ?? []), 'premedication_required' => (bool) $v->premedication_required,
            'has_urgent_note' => trim((string) ($c['urgent_note'] ?? '')) !== '', 'created_at' => $v->created_at];
    }
}
