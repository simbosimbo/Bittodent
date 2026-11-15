<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Http\Requests\FindingRequest;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\CodingSuggestions;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// Draft findings = visual conditions only (karies, hilang, ...): editable/removable by their author until the visit is signed (then final rows
// are frozen by DB trigger). Treatments (code / treatment status) are ProcedureController's; FindingRequest rejects them with 422.
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
            if ($visit->isSigned()) {
                return self::locked();
            }
            $f = ToothFinding::where('visit_id', $id)->where('state', 'draft')->where('created_by', $me)
                ->where('tooth', $d['tooth'])->where('surface', $d['surface'])->first();
            $f ??= new ToothFinding(['patient_id' => $visit->patient_id, 'visit_id' => $id, 'tooth' => $d['tooth'],
                'surface' => $d['surface'], 'created_by' => $me, 'state' => 'draft']);
            $created = ! $f->exists;
            $f->fill(['condition' => $d['condition'], 'source' => $d['source'] ?? 'manual', ...self::diagnosis($d, $f)])->save();
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
            $f->update(['condition' => $d['condition'], 'source' => $d['source'] ?? $f->source, ...self::diagnosis($d, $f)]);
            Audit::log('ubah', 'tooth_finding', $f->id);

            return response()->json(self::coded($f, $d, Visit::findOrFail($f->visit_id)->dentist_id));
        });
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
