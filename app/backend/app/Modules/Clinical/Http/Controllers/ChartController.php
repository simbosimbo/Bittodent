<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Http\Requests\WalkInRequest;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\CorrectionRequest;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\PatientCareSync;
use App\Modules\Clinical\Services\VisitCloser;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ChartController extends Controller
{
    /**
     * GET /api/patients/{id}/chart[?as_of=YYYY-MM-DD]: current odontogram + my drafts + visits with note versions (status derived).
     * as_of = the chart as it stood at the end of that local day (branch timezone, default Asia/Jakarta); see effectiveAt().
     * A future date is allowed and equals the current chart.
     */
    public function show(Request $request, string $id, PatientDirectory $patients, UserDirectory $users, TenancyDirectory $tenancy)
    {
        $asOf = $request->has('as_of') ? $request->validate(['as_of' => ['required', 'date_format:Y-m-d']])['as_of'] : null;
        $cut = $asOf === null ? null : CarbonImmutable::createFromFormat('Y-m-d', $asOf,
            $tenancy->branchOrFail(Ctx::current()->branchId)['timezone'] ?: 'Asia/Jakarta')->endOfDay();
        $patient = $patients->summary($id);
        $me = Ctx::current()->userId;
        $visits = Visit::where('patient_id', $id)->orderByDesc('started_at')->get();
        $notes = ClinicalNote::where('patient_id', $id)->with('versions')->orderBy('created_at')->get();
        $findings = ToothFinding::where('patient_id', $id)->whereIn('state', ['draft', 'final'])
            ->orderBy('finalized_at')->orderBy('id')->get(); // uuid7 id = creation order
        $procedures = ProcedureRecord::where('patient_id', $id)->whereIn('state', ['draft', 'final'])->orderBy('id')->get();
        $defs = ProcedureDefinition::whereIn('procedure_code', $procedures->pluck('procedure_code')->filter()->unique())->get()->keyBy('procedure_code');
        $proc = fn ($p) => ProcedureController::out($p, $defs);
        $requests = CorrectionRequest::whereIn('note_id', $notes->pluck('id'))->where('state', 'diajukan')->get()->keyBy('note_id');

        // Current odontogram: latest final finding per tooth+surface (not superseded). D-021 does this with DISTINCT ON in PG.
        // With as_of, rows (and the successors that supersede them) count only from their effective time on.
        $inForce = fn ($p) => $cut === null || self::effectiveAt($p)->lessThanOrEqualTo($cut);
        $finalFindings = $findings->where('state', 'final')->filter($inForce);
        $superseded = $finalFindings->pluck('supersedes_id')->filter()->flip();
        $current = $finalFindings->reject(fn ($f) => $superseded->has($f->id))->keyBy(fn ($f) => $f->tooth.'-'.$f->surface)->values();

        // an external waiting for confirmation (or rejected) is not chart history: it never hides or replaces today's work (unit 2)
        $history = $procedures->where('state', 'final')->reject(fn ($p) => in_array($p->external_confirmation, ['pending', 'rejected'], true))
            ->filter($inForce)->values();
        $successor = $history->whereNotNull('supersedes_id')->keyBy('supersedes_id');

        $names = collect($users->namesByIds($visits->pluck('dentist_id')->merge($notes->flatMap->versions->pluck('signed_by'))
            ->merge($requests->pluck('requested_by'))->filter()->unique()->values()->all()))->pluck('name', 'id');

        $closer = app(VisitCloser::class);
        $out = $visits->map(fn (Visit $v) => [
            'id' => $v->id, 'appointment_id' => $v->appointment_id, 'branch_id' => $v->branch_id, 'started_at' => $v->started_at,
            'status' => $v->status, 'attendance_cancelled_at' => $v->attendance_cancelled_at, 'dentist' => ['id' => $v->dentist_id, 'name' => $names[$v->dentist_id] ?? null],
            'notes' => $notes->where('visit_id', $v->id)->values()->map(fn ($n) => self::note($n, $names, $requests->get($n->id))),
            'draft_findings' => $findings->where('visit_id', $v->id)->where('state', 'draft')->values()->map(self::finding(...)),
            'draft_procedures' => $procedures->where('visit_id', $v->id)->where('state', 'draft')->values()->map($proc),
            // open visits only (#55): unsigned clinical work closes through Selesai; cancelled attendance may close via /close
            ...($v->status === 'berlangsung' ? ['needs_selesai' => VisitCloser::needsSelesai($v), 'attendance_cancelled' => $closer->attendanceCancelled($v)] : []),
        ]);

        $crossBranch = $visits->contains(fn ($v) => $v->branch_id !== Ctx::current()->branchId);
        Audit::log('baca', 'chart', $id, ['visits' => $visits->count(), 'cross_branch' => $crossBranch, 'as_of' => $asOf]); // D-027

        return response()->json([
            'as_of' => $asOf,
            'patient' => $patient,
            'solo_practice' => $tenancy->activeDentistCount() === 1, // >2x24h corrections: self-approve (D-013) vs owner approval
            'baseline' => ($b = ToothBaseline::where('patient_id', $id)->when($cut, fn ($q) => $q->where('created_at', '<=', $cut->utc()))
                ->orderByDesc('version')->first()) ? BaselineController::out($b) : null,
            'findings' => $current->map(self::finding(...)),
            // drafts and the confirmation queue are work in progress, never part of a past chart
            'drafts' => $cut ? [] : $findings->where('state', 'draft')->where('created_by', $me)->values()->map(self::finding(...)),
            // treatments: every current (final, not superseded, not a `superseded` marker) procedure, several per tooth allowed;
            // findings stay the visual layer
            // (`tidak_dikerjakan` = invalidated by a correction: history / as_of only, never drawn)
            'procedures' => $history->reject(fn ($p) => $successor->has($p->id)
                || in_array($p->status, [ProcedureStatus::SUPERSEDED, ProcedureStatus::NOT_DONE], true))->values()->map($proc),
            // every final row in force, oldest first; superseded_by: the row that replaced/corrected/moved it (as of the cut)
            'procedure_history' => $history->map(fn ($p) => $proc($p) + ['effective_at' => self::effectiveAt($p)->toIso8601String(),
                'superseded_by' => $successor->get($p->id)?->id, 'change' => self::change($successor->get($p->id))]),
            'pending_externals' => $cut ? [] : $procedures->where('external_confirmation', 'pending')->values()->map($proc),
            'procedure_drafts' => $cut ? [] : $procedures->where('state', 'draft')->where('created_by', $me)->values()->map($proc),
            'visits' => $out,
        ]);
    }

    /**
     * When a final row took effect on the chart: finalized_at (signing / the dentist's status, replace or correction write), and for
     * a confirmed external the later of that and the confirmation. Not external_date (an approximate date of work elsewhere):
     * the as-of chart is what this clinic's record showed then. created_at only for migrated rows without finalized_at.
     */
    private static function effectiveAt(ProcedureRecord|ToothFinding $p): CarbonImmutable
    {
        $at = CarbonImmutable::parse($p->finalized_at ?? $p->created_at);
        $ok = $p instanceof ProcedureRecord && $p->external_confirmation === 'confirmed' && $p->external_confirmed_at;

        return $ok ? $at->max(CarbonImmutable::parse($p->external_confirmed_at)) : $at;
    }

    /** How a row was superseded: replaced (`superseded` marker), corrected (same status + reason) or a status change. */
    private static function change(?ProcedureRecord $next): ?string
    {
        return match (true) {
            $next === null => null,
            $next->status === ProcedureStatus::SUPERSEDED => 'digantikan',
            $next->reason !== null => 'koreksi',
            default => 'status',
        };
    }

    /** POST /api/appointments/{id}/visit: idempotent (unique tenant_id+appointment_id). */
    public function visitFromAppointment(string $id, AppointmentDirectory $appointments, PatientCareSync $care)
    {
        $a = $appointments->findOrFail($id);
        if (! Ctx::current()->coversBranch($a['branch_id'])) {
            return Audit::denied('branch:'.$a['branch_id']);
        }
        // Arrived patient: opening the record seats them. A booked one stays booked: a dentist may open the chart ahead of arrival,
        // and the desk can still mark no-show. Replays repair an appointment left at checked_in.
        $seat = fn () => $a['status'] === 'checked_in' ? $appointments->advance($id, 'in_treatment') : null;
        if ($v = Visit::where('appointment_id', $id)->first()) {
            $seat();

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
        $seat();
        $care->push($v->patient_id);

        return response()->json(self::visit($v), 201);
    }

    /**
     * POST /api/patients/{id}/visits/walk-in: open today's visit without an appointment (appointment_id NULL) at the active branch.
     * Idempotent per patient+branch while a visit is `berlangsung` (200 + same visit). An open visit at another branch is not returned.
     */
    public function walkIn(string $id, WalkInRequest $request, PatientDirectory $patients, TenancyDirectory $tenancy, PatientCareSync $care)
    {
        $ctx = Ctx::current();
        if (! $ctx->coversBranch($ctx->branchId)) {
            return Audit::denied('branch:'.$ctx->branchId);
        }
        $dentist = $request->validated('dentist_id') ?? (in_array('dentist', $ctx->roles, true) ? $ctx->userId : null);
        if ($dentist === null) {
            throw ValidationException::withMessages(['dentist_id' => 'Pilih dokter gigi untuk kunjungan ini.']);
        }
        // Branch-scoped list (dentists who may work here), same as booking in Scheduling.
        if (! in_array($dentist, $tenancy->dentistIdsForBranch($ctx->branchId), true)) {
            throw ValidationException::withMessages(['dentist_id' => 'Dokter gigi tidak aktif di cabang ini.']);
        }

        [$v, $created] = DB::transaction(function () use ($id, $patients, $ctx, $dentist) {
            $patients->lock($id); // 404 for other tenants; serializes parallel walk-ins (appointment_id NULL has no unique guard)
            if ($open = Visit::where('patient_id', $id)->where('branch_id', $ctx->branchId)->where('status', 'berlangsung')
                ->orderByDesc('started_at')->first()) {
                return [$open, false];
            }
            $v = Visit::create(['patient_id' => $id, 'branch_id' => $ctx->branchId, 'dentist_id' => $dentist,
                'appointment_id' => null, 'started_at' => now(), 'status' => 'berlangsung', 'created_by' => $ctx->userId]);
            Audit::log('buat', 'visit', $v->id, ['walk_in' => true, 'patient_id' => $id, 'dentist_id' => $dentist, 'branch_id' => $ctx->branchId]);

            return [$v, true];
        });
        if (! $created) {
            return response()->json(self::visit($v)); // replay: no second 'buat'; the chart GET already logs 'baca'
        }
        $care->push($v->patient_id);

        return response()->json(self::visit($v), 201);
    }

    private static function visit(Visit $v): array
    {
        return VisitController::out($v);
    }

    public static function finding(ToothFinding $f): array
    {
        return $f->only(['id', 'visit_id', 'tooth', 'surface', 'condition', 'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'state', 'source', 'approved_at', 'supersedes_id', 'created_by', 'finalized_by', 'finalized_at']);
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
                'source' => $v->source, 'approved_at' => $v->approved_at, 'signed_by' => $v->signed_by, 'signed_by_name' => $names[$v->signed_by] ?? null,
                'signed_at' => $v->signed_at, 'reason' => $v->reason, 'correction_request_id' => $v->correction_request_id,
                'content_hash' => $v->content_hash, 'signature_hash' => $v->signature_hash, 'soap' => $v->soap(),
            ]),
        ];
    }
}
