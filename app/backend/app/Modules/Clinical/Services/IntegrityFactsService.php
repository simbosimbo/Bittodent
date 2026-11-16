<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Contracts\IntegrityFacts;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Models\ProcedureCorrection;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;

final class IntegrityFactsService implements IntegrityFacts
{
    public function externals(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $ext = fn ($q) => $q->whereIn('state', ['draft', 'final'])->where('status', ProcedureStatus::EXTERNAL);

        return ProcedureRecord::where($ext)->where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->where(fn ($q) => $q->whereNull('supersedes_id')->orWhereNotIn('supersedes_id', ProcedureRecord::where($ext)->select('id')))
            ->when($branchIds !== null, fn ($q) => $q->whereIn('visit_id', Visit::whereIn('branch_id', $branchIds)->select('id')))
            ->get()->map(fn ($p) => ['id' => $p->id, 'visit_id' => $p->visit_id, 'patient_id' => $p->patient_id, 'provider_id' => $p->provider_id,
                'procedure_code' => $p->procedure_code, 'tooth' => $p->tooth, 'confirmation' => $p->external_confirmation,
                'recorded_at' => $p->created_at->toIso8601ZuluString()])->all();
    }

    public function visitsWithCompletedWork(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $visits = $this->visits($branchIds)->where('started_at', '>=', $from)->where('started_at', '<', $to)
            ->whereIn('id', VisitCloser::completedProcedures()->select('visit_id'))->get();
        $procs = VisitCloser::completedProcedures()->whereIn('visit_id', $visits->pluck('id'))->get()->groupBy('visit_id');

        return $visits->map(fn ($v) => ['visit_id' => $v->id, 'patient_id' => $v->patient_id, 'branch_id' => $v->branch_id,
            'dentist_id' => $v->dentist_id, 'status' => $v->status, 'started_at' => $v->started_at->toIso8601ZuluString(),
            'closed_without_invoice' => $v->closed_without_invoice,
            'procedures' => $procs->get($v->id, collect())->map(fn ($p) => ['id' => $p->id, 'provider_id' => $p->provider_id,
                'procedure_code' => $p->procedure_code, 'tooth' => $p->tooth])->values()->all()])->values()->all();
    }

    public function cancelledVisits(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        return $this->visits($branchIds)->where(fn ($q) => $q
            ->where(fn ($q) => $q->where('closed_without_invoice', true)->where('ended_at', '>=', $from)->where('ended_at', '<', $to))
            ->orWhere(fn ($q) => $q->where('attendance_cancelled_at', '>=', $from)->where('attendance_cancelled_at', '<', $to)))
            ->get()->map(fn ($v) => ['visit_id' => $v->id, 'patient_id' => $v->patient_id, 'dentist_id' => $v->dentist_id,
                'appointment_id' => $v->appointment_id, 'attendance_cancelled_at' => $v->attendance_cancelled_at?->toIso8601ZuluString(),
                'closed_without_invoice' => $v->closed_without_invoice, 'close_reason' => $v->close_reason,
                'ended_at' => $v->ended_at?->toIso8601ZuluString()])->all();
    }

    public function procedureCorrections(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $corr = ProcedureCorrection::with('decision')->where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->when($branchIds !== null, fn ($q) => $q->whereIn('procedure_id',
                ProcedureRecord::whereIn('visit_id', $this->visits($branchIds)->select('id'))->select('id')))->get();
        $procs = ProcedureRecord::whereIn('id', $corr->pluck('procedure_id'))->get()->keyBy('id');

        // shortcut: correctionChain() walks row by row (few corrections per month); batch it if the report gets slow.
        return $corr->map(fn ($c) => ['id' => $c->id, 'procedure_id' => $c->procedure_id,
            'chain_procedure_ids' => array_map(fn ($r) => $r->id, $procs[$c->procedure_id]->correctionChain()),
            'provider_id' => $procs[$c->procedure_id]->provider_id, 'patient_id' => $procs[$c->procedure_id]->patient_id,
            'visit_id' => $procs[$c->procedure_id]->visit_id, 'reason_type' => $c->reason_type, 'within_window' => $c->within_window,
            'status' => $c->decision->decision ?? 'pending', 'created_at' => $c->created_at->toIso8601ZuluString(),
            'decided_at' => $c->decision?->created_at?->toIso8601ZuluString(),
            'self_approved_sole_owner' => (bool) $c->decision?->self_approved_sole_owner])->values()->all();
    }

    public function dentistsOfVisits(array $visitIds): array
    {
        return Visit::whereIn('id', $visitIds)->pluck('dentist_id', 'id')->all();
    }

    private function visits(?array $branchIds)
    {
        return Visit::query()->when($branchIds !== null, fn ($q) => $q->whereIn('branch_id', $branchIds));
    }
}
