<?php

namespace App\Modules\Prescriptions\Services;

use App\Modules\Prescriptions\Contracts\PrescriptionHistory;
use App\Modules\Prescriptions\Models\Prescription;
use App\Modules\Prescriptions\Models\PrescriptionItem;
use App\Modules\Prescriptions\Models\PrescriptionVoid;

final class PrescriptionHistoryService implements PrescriptionHistory
{
    public function activeSigned(string $patientId, int $months): array
    {
        $rx = Prescription::where('patient_id', $patientId)->where('state', 'signed')->where('signed_at', '>=', now()->subMonths($months))
            ->whereNotIn('id', PrescriptionVoid::select('prescription_id'))->orderByDesc('signed_at')->get();
        $codes = PrescriptionItem::whereIn('prescription_id', $rx->pluck('id'))->orderBy('kfa_code')->get(['tenant_id', 'prescription_id', 'kfa_code'])->groupBy('prescription_id');

        return $rx->map(fn ($p) => ['id' => $p->id, 'visit_id' => $p->visit_id, 'signed_at' => $p->signed_at,
            'kfa_codes' => ($codes[$p->id] ?? collect())->pluck('kfa_code')->unique()->values()->all()])->all();
    }
}
