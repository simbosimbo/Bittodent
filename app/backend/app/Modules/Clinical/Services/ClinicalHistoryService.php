<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\ClinicalHistory;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Patients\Contracts\PatientDirectory;

final class ClinicalHistoryService implements ClinicalHistory
{
    public function __construct(private PatientDirectory $patients) {}

    public function signedHistory(string $patientId, int $months, int $maxVisits): array
    {
        $this->patients->assertExists($patientId); // other tenant => 404
        $since = now()->subMonths($months);
        $inWindow = Visit::where('patient_id', $patientId)->where('started_at', '>=', $since)
            ->orderByDesc('started_at')->orderByDesc('id')->limit($maxVisits + 1)->get();
        $visits = $inWindow->take($maxVisits);

        $noteIds = ClinicalNote::whereIn('visit_id', $visits->pluck('id'))->pluck('visit_id', 'id');
        $signed = ClinicalNoteVersion::whereIn('note_id', $noteIds->keys())->where('state', 'signed')->orderBy('version')->get();
        $superseded = $signed->pluck('supersedes_id')->filter()->flip(); // only a SIGNED correction replaces a version
        $notes = $signed->reject(fn ($v) => $superseded->has($v->id))->map(fn ($v) => [
            'id' => $v->id, 'note_id' => $v->note_id, 'visit_id' => $noteIds[$v->note_id], 'version' => (int) $v->version,
            'content_hash' => $v->content_hash, 'signed_at' => $v->signed_at, 'signed_by' => $v->signed_by, 'soap' => $v->soap(),
        ])->sortByDesc('signed_at')->values()->all();

        $finals = ToothFinding::where('patient_id', $patientId)->where('state', 'final')->orderBy('finalized_at')->orderBy('id')->get();
        $replaced = ToothFinding::where('patient_id', $patientId)->whereNotNull('supersedes_id')->where('state', 'final')->pluck('supersedes_id')->flip();
        $findings = $finals->reject(fn ($f) => $replaced->has($f->id))
            ->keyBy(fn ($f) => $f->tooth.'|'.$f->surface) // latest per tooth+surface wins (same as ChartController)
            ->sortBy(fn ($f) => sprintf('%02d|%s', $f->tooth, $f->surface))->values()
            ->map(fn ($f) => ['id' => $f->id, 'visit_id' => $f->visit_id, 'tooth' => (int) $f->tooth, 'surface' => $f->surface,
                'condition' => $f->condition, 'status' => $f->status, 'procedure_code' => $f->procedure_code, 'finalized_at' => $f->finalized_at])->all();

        $b = ToothBaseline::where('patient_id', $patientId)->orderByDesc('version')->first();

        return [
            'visits' => $visits->map(fn ($v) => ['id' => $v->id, 'branch_id' => $v->branch_id, 'dentist_id' => $v->dentist_id, 'started_at' => $v->started_at])->all(),
            'notes' => $notes,
            'findings' => $findings,
            'baseline' => $b ? ['id' => $b->id, 'version' => (int) $b->version, 'dentition' => $b->dentition, 'teeth' => $b->teeth ?? [], 'created_at' => $b->created_at] : null,
            'truncated' => $inWindow->count() > $maxVisits,
        ];
    }

    public function treatedWithin(string $patientId, string $dentistId, int $months): bool
    {
        return Visit::where('patient_id', $patientId)->where('dentist_id', $dentistId)->where('started_at', '>=', now()->subMonths($months))->exists();
    }
}
