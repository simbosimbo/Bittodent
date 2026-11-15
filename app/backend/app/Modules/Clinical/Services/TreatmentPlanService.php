<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\PlannedTreatment;
use App\Modules\Clinical\Contracts\PlanRefused;
use App\Modules\Clinical\Contracts\TreatmentPlan;
use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// On main a plan is an odontogram row: status direncanakan + procedure_code. The suggestion path only ever adds DRAFT rows
// (source ai_draft) that the dentist signs with the visit like any other draft; tooth_finding final rows and notes stay untouched.
final class TreatmentPlanService implements TreatmentPlan
{
    private const PLANNED = ['direncanakan', 'selesai', 'dirujuk'];

    public function conditions(): array
    {
        return ['surface' => Odontogram::SURFACE_CONDITIONS, 'whole' => Odontogram::WHOLE_CONDITIONS];
    }

    public function currentFindings(string $patientId): array
    {
        $rows = ToothFinding::where('patient_id', $patientId)->where('state', 'final')->orderBy('finalized_at')->orderBy('id')->get();
        $byId = $rows->keyBy('id');
        $superseded = $rows->pluck('supersedes_id')->filter()->flip();
        $depth = function (ToothFinding $f) use ($byId): int {
            for ($n = 1; $f->supersedes_id !== null && ($f = $byId->get($f->supersedes_id)) !== null && $n < 100; $n++);

            return $n;
        };

        return $rows->reject(fn ($f) => $superseded->has($f->id))->keyBy(fn ($f) => $f->tooth.'-'.$f->surface)->values()
            ->map(fn (ToothFinding $f) => ['id' => $f->id, 'version' => $depth($f), 'tooth' => (int) $f->tooth, 'surface' => $f->surface,
                'condition' => $f->condition, 'status' => $f->status, 'procedure_code' => $f->procedure_code,
                'finalized_at' => $f->finalized_at?->toIso8601String()])
            ->all();
    }

    public function plannedItems(string $patientId): array
    {
        $current = collect($this->currentFindings($patientId))->whereIn('status', self::PLANNED)
            ->map(fn ($f) => [...array_intersect_key($f, array_flip(['tooth', 'surface', 'status', 'procedure_code'])), 'state' => 'final']);
        $drafts = ToothFinding::where('patient_id', $patientId)->where('state', 'draft')->get()
            ->map(fn ($f) => ['tooth' => (int) $f->tooth, 'surface' => $f->surface, 'status' => $f->status, 'procedure_code' => $f->procedure_code, 'state' => 'draft']);

        return $current->concat($drafts)->values()->all();
    }

    public function visit(string $visitId): ?array
    {
        $v = Visit::find($visitId);

        return $v ? ['id' => $v->id, 'patient_id' => $v->patient_id, 'branch_id' => $v->branch_id, 'dentist_id' => $v->dentist_id, 'open' => self::isOpen($v)] : null;
    }

    public function openVisitOf(string $patientId): ?string
    {
        return Visit::where('patient_id', $patientId)->where('status', 'berlangsung')->orderByDesc('started_at')->get()
            ->first(fn (Visit $v) => self::isOpen($v))?->id;
    }

    public function addPlannedDraft(string $visitId, PlannedTreatment $item): array
    {
        $surfaces = $item->surfaces === [] ? [null] : array_values(array_unique($item->surfaces));
        foreach ($surfaces as $s) {
            if (Odontogram::error($item->tooth, $s, $item->condition) !== null) {
                throw new PlanRefused(PlanRefused::INVALID);
            }
        }
        $ctx = Ctx::current();

        return DB::transaction(function () use ($visitId, $item, $surfaces, $ctx) {
            $visit = Visit::lockForUpdate()->findOrFail($visitId);
            if (! $ctx->coversBranch($visit->branch_id)) {
                throw new PlanRefused(PlanRefused::BRANCH);
            }
            if (! self::isOpen($visit)) {
                throw new PlanRefused(PlanRefused::VISIT_CLOSED);
            }
            $ids = [];
            foreach ($surfaces as $i => $s) {
                $code = $i === 0 ? $item->procedureCode : null; // one procedure: billed once when it becomes selesai
                $existing = ToothFinding::where('visit_id', $visitId)->where('state', 'draft')->where('tooth', $item->tooth)
                    ->where(fn ($q) => $s === null ? $q->whereNull('surface') : $q->where('surface', $s))->first();
                if ($existing) {
                    if ($existing->status === 'direncanakan' && $existing->condition === $item->condition && $existing->procedure_code === $code) {
                        $ids[] = $existing->id;

                        continue;
                    }
                    throw new PlanRefused(PlanRefused::DRAFT_EXISTS);
                }
                $f = ToothFinding::create(['patient_id' => $visit->patient_id, 'visit_id' => $visitId, 'tooth' => $item->tooth, 'surface' => $s,
                    'condition' => $item->condition, 'status' => 'direncanakan', 'procedure_code' => $code, 'variant' => 'standar',
                    'state' => 'draft', 'source' => 'ai_draft', 'created_by' => $ctx->userId]);
                Audit::log('buat', 'tooth_finding', $f->id, ['tooth' => $f->tooth, 'surface' => $f->surface, 'source' => 'ai_draft', 'status' => 'direncanakan']);
                $ids[] = $f->id;
            }

            return $ids;
        });
    }

    private static function isOpen(Visit $v): bool
    {
        return $v->status === 'berlangsung'
            && ! ClinicalNote::where('visit_id', $v->id)->whereHas('versions', fn ($q) => $q->where('state', 'signed'))->exists();
    }
}
