<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\CorrectionRequest;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\UniqueConstraintViolationException;

class ChartController extends Controller
{
    /** GET /api/patients/{id}/chart: current odontogram + my drafts + visits with note versions (status derived). */
    public function show(string $id, PatientDirectory $patients, UserDirectory $users, TenancyDirectory $tenancy)
    {
        $patient = $patients->summary($id);
        $me = Ctx::current()->userId;
        $visits = Visit::where('patient_id', $id)->orderByDesc('started_at')->get();
        $notes = ClinicalNote::where('patient_id', $id)->with('versions')->orderBy('created_at')->get();
        $findings = ToothFinding::where('patient_id', $id)->whereIn('state', ['draft', 'final'])
            ->orderBy('finalized_at')->orderBy('id')->get(); // uuid7 id = creation order
        $requests = CorrectionRequest::whereIn('note_id', $notes->pluck('id'))->where('state', 'diajukan')->get()->keyBy('note_id');

        // Current odontogram: latest final finding per tooth+surface (not superseded). D-021 does this with DISTINCT ON in PG.
        $superseded = $findings->pluck('supersedes_id')->filter()->flip();
        $current = $findings->where('state', 'final')->reject(fn ($f) => $superseded->has($f->id))
            ->keyBy(fn ($f) => $f->tooth.'-'.$f->surface)->values();

        $names = collect($users->namesByIds($visits->pluck('dentist_id')->merge($notes->flatMap->versions->pluck('signed_by'))
            ->merge($requests->pluck('requested_by'))->filter()->unique()->values()->all()))->pluck('name', 'id');

        $out = $visits->map(fn (Visit $v) => [
            'id' => $v->id, 'appointment_id' => $v->appointment_id, 'branch_id' => $v->branch_id, 'started_at' => $v->started_at,
            'status' => $v->status, 'dentist' => ['id' => $v->dentist_id, 'name' => $names[$v->dentist_id] ?? null],
            'notes' => $notes->where('visit_id', $v->id)->values()->map(fn ($n) => self::note($n, $names, $requests->get($n->id))),
            'draft_findings' => $findings->where('visit_id', $v->id)->where('state', 'draft')->values()->map(self::finding(...)),
        ]);

        $crossBranch = $visits->contains(fn ($v) => $v->branch_id !== Ctx::current()->branchId);
        Audit::log('baca', 'chart', $id, ['visits' => $visits->count(), 'cross_branch' => $crossBranch]); // D-027

        return response()->json([
            'patient' => $patient,
            'solo_practice' => $tenancy->activeDentistCount() === 1, // >2x24h corrections: self-approve (D-013) vs owner approval
            'baseline' => ($b = ToothBaseline::where('patient_id', $id)->orderByDesc('version')->first()) ? BaselineController::out($b) : null,
            'findings' => $current->map(self::finding(...)),
            'drafts' => $findings->where('state', 'draft')->where('created_by', $me)->values()->map(self::finding(...)),
            'visits' => $out,
        ]);
    }

    /** POST /api/appointments/{id}/visit: idempotent (unique tenant_id+appointment_id). */
    public function visitFromAppointment(string $id, AppointmentDirectory $appointments)
    {
        $a = $appointments->findOrFail($id);
        if (! Ctx::current()->coversBranch($a['branch_id'])) {
            return Audit::denied('branch:'.$a['branch_id']);
        }
        if ($v = Visit::where('appointment_id', $id)->first()) {
            return response()->json(self::visit($v));
        }
        if (in_array($a['status'], ['cancelled', 'no_show'], true)) {
            return response()->json(['error' => 'appointment_closed', 'message' => 'Janji ini batal/tidak datang.'], 409);
        }
        try {
            $v = Visit::create(['patient_id' => $a['patient_id'], 'branch_id' => $a['branch_id'], 'dentist_id' => $a['dentist_id'],
                'appointment_id' => $id, 'started_at' => now(), 'status' => 'berlangsung', 'created_by' => Ctx::current()->userId]);
        } catch (UniqueConstraintViolationException) { // a parallel request won
            return response()->json(self::visit(Visit::where('appointment_id', $id)->firstOrFail()));
        }
        Audit::log('buat', 'visit', $v->id, ['appointment_id' => $id]);

        return response()->json(self::visit($v), 201);
    }

    private static function visit(Visit $v): array
    {
        return $v->only(['id', 'patient_id', 'branch_id', 'dentist_id', 'appointment_id', 'started_at', 'status']);
    }

    public static function finding(ToothFinding $f): array
    {
        return $f->only(['id', 'visit_id', 'tooth', 'surface', 'condition', 'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'state', 'source', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at']);
    }

    private static function note(ClinicalNote $n, $names, ?CorrectionRequest $pending): array
    {
        $superseded = $n->versions->pluck('supersedes_id')->filter()->flip();

        return [
            'id' => $n->id, 'author_id' => $n->author_id, 'created_at' => $n->created_at,
            'pending_correction' => $pending ? ['id' => $pending->id, 'reason' => $pending->reason, 'requested_by' => $pending->requested_by,
                'requested_by_name' => $names[$pending->requested_by] ?? null, 'created_at' => $pending->created_at] : null,
            'versions' => $n->versions->map(fn ($v) => [
                'id' => $v->id, 'version' => $v->version, 'revision' => $v->revision, 'supersedes_id' => $v->supersedes_id,
                // 'digantikan' is derived from supersedes_id, never stored on the old row.
                'status' => $v->state === 'draft' ? 'draf' : ($superseded->has($v->id) ? 'digantikan' : 'berlaku'),
                'source' => $v->source, 'signed_by' => $v->signed_by, 'signed_by_name' => $names[$v->signed_by] ?? null,
                'signed_at' => $v->signed_at, 'reason' => $v->reason, 'correction_request_id' => $v->correction_request_id,
                'content_hash' => $v->content_hash, 'soap' => $v->soap(),
            ]),
        ];
    }
}
