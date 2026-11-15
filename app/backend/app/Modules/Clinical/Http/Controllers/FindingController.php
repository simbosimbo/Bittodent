<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Clinical\Http\Requests\FindingRequest;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\CodingSuggestions;
use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Draft findings: editable/removable by their author until the visit is signed (then final rows are frozen by DB trigger).
class FindingController extends Controller
{
    /** POST /api/visits/{id}/findings: one draft per author+tooth+surface in a visit (re-picking a condition updates it). */
    public function store(FindingRequest $request, string $id)
    {
        $d = $request->validated();
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $me) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            if (ClinicalNote::where('visit_id', $id)->whereHas('versions', fn ($q) => $q->where('state', 'signed'))->exists()) {
                return self::locked();
            }
            $f = ToothFinding::where('visit_id', $id)->where('state', 'draft')->where('created_by', $me)
                ->where('tooth', $d['tooth'])->where('surface', $d['surface'])->first();
            $f ??= new ToothFinding(['patient_id' => $visit->patient_id, 'visit_id' => $id, 'tooth' => $d['tooth'],
                'surface' => $d['surface'], 'created_by' => $me, 'state' => 'draft']);
            $created = ! $f->exists;
            $f->fill(['condition' => $d['condition'], 'source' => $d['source'] ?? 'manual', ...self::procedure($d, $f), ...self::diagnosis($d, $f)])->save();
            Audit::log($created ? 'buat' : 'ubah', 'tooth_finding', $f->id, ['tooth' => $f->tooth, 'surface' => $f->surface]);

            return response()->json(self::coded($f, $d, $visit->dentist_id), $created ? 201 : 200);
        });
    }

    /** PATCH /api/findings/{id} */
    public function update(FindingRequest $request, string $id)
    {
        return $this->ownDraft($id, function (ToothFinding $f) use ($request) {
            $d = $request->validated();
            if ($e = Odontogram::error($f->tooth, $f->surface, $d['condition'])) {
                return response()->json(['message' => $e, 'errors' => ['condition' => [$e]]], 422);
            }
            $f->update(['condition' => $d['condition'], 'source' => $d['source'] ?? $f->source, ...self::procedure($d, $f), ...self::diagnosis($d, $f)]);
            Audit::log('ubah', 'tooth_finding', $f->id);

            return response()->json(self::coded($f, $d, Visit::findOrFail($f->visit_id)->dentist_id));
        });
    }

    /**
     * POST /api/findings/{id}/status {to, visit_id?}: status change on a FINAL item = new final row superseding it (append-only),
     * only along ProcedureStatus::TRANSITIONS. Dentist only (route perm note.sign). `selesai` raises ProcedureRecorded (Billing listens).
     */
    public function changeStatus(Request $request, string $id)
    {
        $d = $request->validate(['to' => ['required', 'string', 'in:'.implode(',', ProcedureStatus::ALL)], 'visit_id' => ['nullable', 'uuid']]);
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx) {
            $f = ToothFinding::lockForUpdate()->where('state', 'final')->findOrFail($id);
            if (ToothFinding::where('supersedes_id', $id)->exists()) {
                return response()->json(['error' => 'superseded', 'message' => 'Item ini sudah digantikan; muat ulang.'], 409);
            }
            if (! ProcedureStatus::canMove($f->status, $d['to'])) {
                return response()->json(['error' => 'invalid_transition', 'message' => "Status tidak bisa berpindah dari {$f->status} ke {$d['to']}."], 409);
            }
            $visit = Visit::where('patient_id', $f->patient_id)->findOrFail($d['visit_id'] ?? $f->visit_id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            $new = ToothFinding::create([...$f->only(['patient_id', 'tooth', 'surface', 'condition', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source']),
                'visit_id' => $visit->id, 'status' => $d['to'], 'state' => 'final', 'source' => 'manual', 'supersedes_id' => $f->id,
                'created_by' => $ctx->userId, 'finalized_by' => $ctx->userId, 'finalized_at' => now()]);
            Audit::log('ubah_status', 'tooth_finding', $new->id, ['supersedes' => $f->id, 'from' => $f->status, 'to' => $d['to']]);
            if ($new->status === 'selesai') {
                self::recorded($new);
            }

            return response()->json(ChartController::finding($new), 201);
        });
    }

    /** Raised for a final `selesai` item with a procedure code. Carries no price (Clinical never knows prices). */
    public static function recorded(ToothFinding $f): void
    {
        if ($f->procedure_code !== null) {
            $dentist = Visit::findOrFail($f->visit_id)->dentist_id;
            $profile = app(DentistProfileDirectory::class)->of($dentist);
            event(new ProcedureRecorded(Ctx::current()->tenant(), $f->visit_id, $f->procedure_code, $f->variant, (string) $f->tooth, $f->id,
                $dentist, $profile['category'], $profile['field'], $f->surface));
        }
    }

    private static function procedure(array $d, ToothFinding $f): array
    {
        return ['status' => $d['status'] ?? $f->status ?? 'kondisi_pantau', 'procedure_code' => array_key_exists('procedure_code', $d) ? $d['procedure_code'] : $f->procedure_code,
            'variant' => $d['variant'] ?? $f->variant ?? 'standar'];
    }

    /** ICD-10 per finding: a code set through the API without a source is `manual`; no code = no source. */
    private static function diagnosis(array $d, ToothFinding $f): array
    {
        $sent = array_key_exists('diagnosis_code', $d);
        $code = $sent ? $d['diagnosis_code'] : $f->diagnosis_code;

        return ['diagnosis_code' => $code, 'diagnosis_source' => $code === null ? null : ($d['diagnosis_source'] ?? ($sent ? 'manual' : $f->diagnosis_source))];
    }

    /**
     * A diagnosis_code sent in the request counts as the visit dentist's choice (coding_preference). Without a code the JSON
     * carries `suggestions` only; diagnosis_code is never filled in automatically.
     */
    private static function coded(ToothFinding $f, array $d, string $dentistId): array
    {
        if (isset($d['diagnosis_code'])) {
            CodingSuggestions::recordChoice($dentistId, $f->condition, $f->diagnosis_code);
        }

        return ChartController::finding($f) + ($f->diagnosis_code === null
            ? ['suggestions' => CodingSuggestions::for($f->condition, $f->tooth, $f->surface, $dentistId)] : []);
    }

    /** DELETE /api/findings/{id}: no SQL DELETE on clinical tables; the draft is marked `discarded`. */
    public function destroy(string $id)
    {
        return $this->ownDraft($id, function (ToothFinding $f) {
            $f->update(['state' => 'discarded']);
            Audit::log('buang_draf', 'tooth_finding', $f->id);

            return response()->noContent();
        });
    }

    private function ownDraft(string $id, callable $fn)
    {
        return DB::transaction(function () use ($id, $fn) {
            $f = ToothFinding::lockForUpdate()->where('state', '!=', 'discarded')->findOrFail($id);
            if ($f->state !== 'draft') {
                return self::locked();
            }
            if ($f->created_by !== Ctx::current()->userId) {
                return Audit::denied('tooth_finding.author');
            }

            return $fn($f);
        });
    }

    private static function locked()
    {
        return response()->json(['error' => 'signed', 'message' => 'Sudah ditandatangani; perubahan lewat koreksi.'], 409);
    }
}
