<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\ProcedureCatalog;
use App\Modules\Clinical\Domain\ProcedureLocation;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Clinical\Http\Requests\ProcedureRequest;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Treatments (procedure_record). Drafts are editable/discardable by their author until the visit is signed; signing finalizes them
// (NoteController::sign). A status change on a final row = new final row superseding it. Only `selesai` + code bills (ProcedureRecorded).
class ProcedureController extends Controller
{
    /** POST /api/visits/{id}/procedures: one draft per call (a MOD filling = one row with surfaces "MOD"). */
    public function store(ProcedureRequest $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validated();
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx, $tenancy) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            if ($visit->isSigned()) {
                return self::locked();
            }
            $attrs = self::attributes($d, $visit, $tenancy);
            if (! is_array($attrs)) {
                return $attrs;
            }
            $p = ProcedureRecord::create([...$attrs, 'patient_id' => $visit->patient_id, 'visit_id' => $visit->id, 'state' => 'draft',
                'source' => $d['source'] ?? 'manual', 'created_by' => $ctx->userId]);
            Audit::log('buat', 'procedure_record', $p->id, ['tooth' => $p->tooth, 'surfaces' => $p->surfaces]);

            return response()->json(self::out($p), 201);
        });
    }

    /** PATCH /api/procedures/{id}: own draft only; sent fields replace the stored ones, then location is re-checked as a whole. */
    public function update(ProcedureRequest $request, string $id, TenancyDirectory $tenancy)
    {
        return $this->ownDraft($id, function (ProcedureRecord $p) use ($request, $tenancy) {
            $d = $request->validated();
            // unsent fields keep their stored value (an explicit null clears one); location is re-checked against the code as a whole
            // a new code brings its own catalog area, so the stored area is only kept while the code stays
            if (! array_key_exists('procedure_code', $d) || $d['procedure_code'] === $p->procedure_code) {
                $d += ['treat_area' => $p->treat_area];
            }
            $d += $p->only(['tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch', 'status', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'provider_id']);
            $attrs = self::attributes($d, Visit::findOrFail($p->visit_id), $tenancy);
            if (! is_array($attrs)) {
                return $attrs;
            }
            $p->update([...$attrs, 'source' => $d['source'] ?? $p->source]);
            Audit::log('ubah', 'procedure_record', $p->id);

            return response()->json(self::out($p));
        });
    }

    /**
     * POST /api/procedures/{id}/status {to, visit_id?, provider_id?}: dentist only (route perm note.sign). New final row superseding
     * the old one, only along ProcedureStatus::TRANSITIONS. Provider defaults to the dentist of the visit where the change is recorded.
     */
    public function changeStatus(Request $request, string $id, TenancyDirectory $tenancy)
    {
        $request->merge(['to' => ProcedureStatus::normalize($request->input('to'))]);
        $d = $request->validate(['to' => ['required', 'string', 'in:'.implode(',', ProcedureStatus::WRITABLE)],
            'visit_id' => ['nullable', 'uuid'], 'provider_id' => ['nullable', 'uuid']]);
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx, $tenancy) {
            $p = ProcedureRecord::lockForUpdate()->where('state', 'final')->findOrFail($id);
            if (ProcedureRecord::where('supersedes_id', $id)->exists()) {
                return response()->json(['error' => 'superseded', 'message' => 'Tindakan ini sudah digantikan; muat ulang.'], 409);
            }
            if (! ProcedureStatus::canMove($p->status, $d['to'])) {
                return response()->json(['error' => 'invalid_transition', 'message' => "Status tidak bisa berpindah dari {$p->status} ke {$d['to']}."], 409);
            }
            $visit = Visit::where('patient_id', $p->patient_id)->findOrFail($d['visit_id'] ?? $p->visit_id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            $provider = $d['provider_id'] ?? $visit->dentist_id;
            if ($bad = self::badProvider($provider, $visit, $tenancy)) {
                return $bad;
            }
            $new = ProcedureRecord::create([...$p->only(['patient_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch',
                'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source']),
                'visit_id' => $visit->id, 'provider_id' => $provider, 'status' => $d['to'], 'state' => 'final', 'source' => 'manual',
                'supersedes_id' => $p->id, 'created_by' => $ctx->userId, 'finalized_by' => $ctx->userId, 'finalized_at' => now()]);
            Audit::log('ubah_status', 'procedure_record', $new->id, ['supersedes' => $p->id, 'from' => $p->status, 'to' => $d['to']]);
            self::recorded($new);

            return response()->json(self::out($new), 201);
        });
    }

    /** DELETE /api/procedures/{id}: no SQL DELETE on clinical tables; the draft is marked `discarded`. */
    public function destroy(string $id)
    {
        return $this->ownDraft($id, function (ProcedureRecord $p) {
            $p->update(['state' => 'discarded']);
            Audit::log('buang_draf', 'procedure_record', $p->id);

            return response()->noContent();
        });
    }

    /** The ONLY billing trigger: a final `selesai` procedure with a code. Carries no price (Clinical never knows prices). */
    public static function recorded(ProcedureRecord $p): void
    {
        if ($p->state !== 'final' || $p->status !== ProcedureStatus::BILLABLE || $p->procedure_code === null) {
            return;
        }
        $profile = app(DentistProfileDirectory::class)->of($p->provider_id);
        event(new ProcedureRecorded(Ctx::current()->tenant(), $p->visit_id, $p->procedure_code, $p->variant,
            $p->tooth === null ? null : (string) $p->tooth, $p->id, $p->provider_id, $profile['category'], $profile['field'], $p->surfaces));
    }

    /** Chart / API shape. $defs = catalog rows keyed by code (pass for lists to avoid one query per row). */
    public static function out(ProcedureRecord $p, ?Collection $defs = null): array
    {
        $def = $p->procedure_code === null ? null
            : ($defs ? $defs->get($p->procedure_code) : ProcedureDefinition::where('procedure_code', $p->procedure_code)->first());

        return $p->only(['id', 'visit_id', 'patient_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch', 'status',
            'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'provider_id', 'state', 'source', 'supersedes_id',
            'created_by', 'finalized_by', 'finalized_at'])
            + ['paint_type' => $def?->paint_type ?? ProcedureCatalog::DEFAULT_PAINT, 'name' => $def?->name, 'layman' => $def?->layman];
    }

    /** Validated columns, or an error response. */
    private static function attributes(array $d, Visit $visit, TenancyDirectory $tenancy): array|JsonResponse
    {
        $code = $d['procedure_code'] ?? null;
        $def = $code === null ? null : ProcedureDefinition::where('procedure_code', $code)->first();
        [$loc, $e] = ProcedureLocation::resolve($d, $def);
        if ($e) {
            return response()->json(['message' => $e[1], 'errors' => [$e[0] => [$e[1]]]], 422);
        }
        $provider = $d['provider_id'] ?? $visit->dentist_id;
        if ($bad = self::badProvider($provider, $visit, $tenancy)) {
            return $bad;
        }
        $dx = $d['diagnosis_code'] ?? null;

        return [...$loc, 'status' => $d['status'], 'procedure_code' => $code, 'variant' => $d['variant'] ?? 'standar', 'provider_id' => $provider,
            // a code set through the API without a source is `manual`; no code = no source
            'diagnosis_code' => $dx, 'diagnosis_source' => $dx === null ? null : ($d['diagnosis_source'] ?? 'manual')];
    }

    /** provider must be an active dentist of this tenant who may work in the visit's branch. */
    private static function badProvider(string $provider, Visit $visit, TenancyDirectory $tenancy): ?JsonResponse
    {
        if ($provider === $visit->dentist_id || in_array($provider, $tenancy->dentistIdsForBranch($visit->branch_id), true)) {
            return null;
        }
        $m = 'Dokter pelaksana harus dokter gigi aktif di klinik dan cabang ini.';

        return response()->json(['message' => $m, 'errors' => ['provider_id' => [$m]]], 422);
    }

    private function ownDraft(string $id, callable $fn)
    {
        return DB::transaction(function () use ($id, $fn) {
            $p = ProcedureRecord::lockForUpdate()->where('state', '!=', 'discarded')->findOrFail($id);
            if ($p->state !== 'draft') {
                return self::locked();
            }
            if ($p->created_by !== Ctx::current()->userId) {
                return Audit::denied('procedure_record.author');
            }

            return $fn($p);
        });
    }

    private static function locked()
    {
        return response()->json(['error' => 'signed', 'message' => 'Sudah ditandatangani; perubahan lewat status atau koreksi.'], 409);
    }
}
