<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\ApproxDate;
use App\Modules\Clinical\Domain\ProcedureCatalog;
use App\Modules\Clinical\Domain\ProcedureLocation;
use App\Modules\Clinical\Domain\ProcedureSite;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Clinical\Http\Requests\ProcedureHistoryRequest;
use App\Modules\Clinical\Http\Requests\ProcedureRequest;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Treatments (procedure_record). Drafts are editable/discardable by their author until the visit is signed; signing finalizes them
// (NoteController::sign). A status change on a final row = new final row superseding it. Only `selesai` + code bills (ProcedureRecorded).
class ProcedureController extends Controller
{
    private const SITE = ['treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch'];

    /** Copied onto a successor row (status change, replace marker). */
    private const COPY = ['patient_id', ...self::SITE, 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source'];

    private const CORRECTABLE = ['tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch', 'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'provider_id'];

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
            Audit::log('buat', 'procedure_record', $p->id, ['tooth' => $p->tooth, 'surfaces' => $p->surfaces, ...self::externalAudit($p)]);

            return response()->json(self::out($p), 201);
        });
    }

    /** PATCH /api/procedures/{id}: own draft only; sent fields replace the stored ones, then location is re-checked as a whole. */
    public function update(ProcedureRequest $request, string $id, TenancyDirectory $tenancy)
    {
        return $this->ownDraft($id, function (ProcedureRecord $p) use ($request, $tenancy) {
            $d = self::merged($request->validated(), $p);
            $attrs = self::attributes($d, Visit::lockForUpdate()->findOrFail($p->visit_id), $tenancy, $p->id);
            if (! is_array($attrs)) {
                return $attrs;
            }
            $p->update([...$attrs, 'source' => $d['source'] ?? $p->source]);
            Audit::log('ubah', 'procedure_record', $p->id, self::externalAudit($p));

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
            if ($e = self::notCurrent($p)) {
                return $e;
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
            $new = ProcedureRecord::create([...$p->only(self::COPY),
                'visit_id' => $visit->id, 'provider_id' => $provider, 'status' => $d['to'], 'state' => 'final', 'source' => 'manual',
                'supersedes_id' => $p->id, 'created_by' => $ctx->userId, 'finalized_by' => $ctx->userId, 'finalized_at' => now()]);
            Audit::log('ubah_status', 'procedure_record', $new->id, ['supersedes' => $p->id, 'from' => $p->status, 'to' => $d['to']]);
            self::recorded($new);

            return response()->json(self::out($new), 201);
        });
    }

    /**
     * POST /api/procedures/{id}/replace {visit_id, status direncanakan|selesai, reason, code + site ...}: dentist only (note.sign).
     * Replacing existing work (selesai / ada_di_klinik_ini / ada_di_tempat_lain) on an overlapping site. Two new final rows, old row
     * untouched: a `superseded` marker that supersedes the old one (copy of it + reason) and the new work with replaces_id = old.
     * The old invoice_line stays; the new work bills only when it is (or later becomes) selesai.
     */
    public function replace(ProcedureHistoryRequest $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validated();
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx, $tenancy) {
            $old = ProcedureRecord::lockForUpdate()->where('state', 'final')->findOrFail($id);
            if ($e = self::notCurrent($old)) {
                return $e;
            }
            if (! in_array($old->status, ProcedureStatus::REPLACEABLE, true)) {
                return response()->json(['error' => 'not_replaceable', 'message' => 'Hanya pekerjaan yang sudah ada (selesai, ada di klinik ini, klinik lain) yang bisa diganti.'], 409);
            }
            $visit = Visit::lockForUpdate()->where('patient_id', $old->patient_id)->findOrFail($d['visit_id']);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            $attrs = self::attributes($d, $visit, $tenancy);
            if (! is_array($attrs)) {
                return $attrs;
            }
            if (! ProcedureSite::overlaps($attrs, $old->only(self::SITE))) {
                return self::invalid('tooth', 'Tindakan pengganti harus pada gigi/permukaan yang sama dengan tindakan lama.');
            }
            $final = ['state' => 'final', 'source' => 'manual', 'reason' => $d['reason'], 'created_by' => $ctx->userId,
                'finalized_by' => $ctx->userId, 'finalized_at' => now()];
            $marker = ProcedureRecord::create([...$old->only([...self::COPY, 'provider_id', 'replaces_id', 'external_clinic_name', 'external_date',
                'external_date_precision', 'external_confirmation', 'external_confirmed_by', 'external_confirmed_at', 'external_confirmation_reason']),
                ...$final, 'visit_id' => $visit->id, 'status' => ProcedureStatus::SUPERSEDED, 'supersedes_id' => $old->id]);
            $new = ProcedureRecord::create([...$attrs, ...$final, 'patient_id' => $old->patient_id, 'visit_id' => $visit->id, 'replaces_id' => $old->id]);
            Audit::log('ganti_tindakan', 'procedure_record', $new->id, ['replaces' => $old->id, 'marker' => $marker->id, 'from' => $old->status, 'to' => $new->status]);
            self::recorded($new);

            return response()->json(['replaced' => self::out($marker), 'procedure' => self::out($new)], 201);
        });
    }

    /**
     * POST /api/procedures/{id}/corrections {reason, code/site/diagnosis/variant/provider/external fields}: dentist only (note.sign).
     * New final row superseding the old one with the same status; the old row stays readable. Never bills: an already billed
     * line stays on the old procedure (billing correction = Billing's job). Not hooked to correction_request yet (DEVIATIONS #49).
     */
    public function correct(ProcedureHistoryRequest $request, string $id, TenancyDirectory $tenancy)
    {
        $ctx = Ctx::current();

        return DB::transaction(function () use ($request, $id, $ctx, $tenancy) {
            $p = ProcedureRecord::lockForUpdate()->where('state', 'final')->findOrFail($id);
            if ($e = self::notCurrent($p)) {
                return $e;
            }
            $visit = Visit::lockForUpdate()->findOrFail($p->visit_id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            $d = self::merged($request->validated(), $p);
            $attrs = self::attributes($d, $visit, $tenancy, $p->id);
            if (! is_array($attrs)) {
                return $attrs;
            }
            if ($p->status === ProcedureStatus::EXTERNAL) { // already confirmed or never needed it: a correction does not re-open that
                $attrs = [...$attrs, ...$p->only(['external_confirmation', 'external_confirmed_by', 'external_confirmed_at', 'external_confirmation_reason'])];
            }
            $new = ProcedureRecord::create([...$attrs, 'patient_id' => $p->patient_id, 'visit_id' => $p->visit_id, 'state' => 'final',
                'source' => 'manual', 'supersedes_id' => $p->id, 'replaces_id' => $p->replaces_id, 'reason' => $d['reason'],
                'created_by' => $ctx->userId, 'finalized_by' => $ctx->userId, 'finalized_at' => now()]);
            Audit::log('koreksi_tindakan', 'procedure_record', $new->id, ['supersedes' => $p->id,
                'fields' => array_values(array_filter(self::CORRECTABLE, fn ($c) => (string) $new->$c !== (string) $p->$c))]);

            return response()->json(self::out($new), 201);
        });
    }

    /** GET /api/procedures/pending-external: external entries of the active branch waiting for confirmation (front desk / assistant). */
    public function pendingExternal()
    {
        $rows = ProcedureRecord::where('external_confirmation', 'pending')->whereIn('state', ['draft', 'final'])
            ->whereIn('visit_id', Visit::where('branch_id', Ctx::current()->branchId)->select('id'))->orderBy('id')->get();
        $defs = ProcedureDefinition::whereIn('procedure_code', $rows->pluck('procedure_code')->filter()->unique())->get()->keyBy('procedure_code');

        // no diagnosis: the confirmer checks site + clinic + date against today's work, not the clinical picture
        return response()->json($rows->map(fn ($p) => array_diff_key(self::out($p, $defs), array_flip(['diagnosis_code', 'diagnosis_source'])))->values());
    }

    /**
     * POST /api/procedures/{id}/confirm-external {confirm, reason?}: perm procedure.confirm_external (front desk, assistant).
     * Only a `pending` external; confirming is refused when the site got `selesai` work that day since it was entered (same rule as recording).
     * Reject = `rejected` (no SQL DELETE); both are audited. A final pending row may change only these columns (DB trigger).
     */
    public function confirmExternal(Request $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validate(['confirm' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:300']]);
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx, $tenancy) {
            $p = ProcedureRecord::lockForUpdate()->whereIn('state', ['draft', 'final'])->findOrFail($id);
            $visit = Visit::lockForUpdate()->findOrFail($p->visit_id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            if ($p->external_confirmation !== 'pending') {
                return response()->json(['error' => 'not_pending', 'message' => 'Tindakan ini tidak sedang menunggu konfirmasi.'], 409);
            }
            if ($d['confirm'] && ($e = self::sameSite($p->only(['treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch']), $visit, $tenancy, $p->id))) {
                return $e;
            }
            $p->update(['external_confirmation' => $d['confirm'] ? 'confirmed' : 'rejected', 'external_confirmed_by' => $ctx->userId,
                'external_confirmed_at' => now(), 'external_confirmation_reason' => $d['reason'] ?? null]);
            Audit::log($d['confirm'] ? 'konfirmasi_tindakan_luar' : 'tolak_tindakan_luar', 'procedure_record', $p->id,
                [...self::externalAudit($p), 'reason_given' => isset($d['reason'])]);

            return response()->json(self::out($p));
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
            'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'provider_id', 'state', 'source', 'supersedes_id', 'reason', 'replaces_id',
            'created_by', 'finalized_by', 'finalized_at', 'external_clinic_name', 'external_date_precision', 'external_confirmation',
            'external_confirmed_by', 'external_confirmed_at', 'external_confirmation_reason'])
            + ['external_date' => $p->external_date ? substr((string) $p->external_date, 0, 10) : null]
            + ['paint_type' => $def?->paint_type ?? ProcedureCatalog::DEFAULT_PAINT, 'name' => $def?->name, 'layman' => $def?->layman];
    }

    /** 409 unless $p is the latest row of its chain, not a `superseded` marker, and not an unconfirmed/rejected external. */
    private static function notCurrent(ProcedureRecord $p): ?JsonResponse
    {
        if ($p->status === ProcedureStatus::SUPERSEDED || ProcedureRecord::where('supersedes_id', $p->id)->exists()) {
            return response()->json(['error' => 'superseded', 'message' => 'Tindakan ini sudah digantikan; muat ulang.'], 409);
        }
        if (in_array($p->external_confirmation, ['pending', 'rejected'], true)) {
            return response()->json(['error' => 'external_unconfirmed', 'message' => 'Tindakan klinik lain ini belum dikonfirmasi atau ditolak.'], 409);
        }

        return null;
    }

    /** Sent fields over the stored row: unsent keep their value (explicit null clears); a new code brings its own catalog area. */
    private static function merged(array $d, ProcedureRecord $p): array
    {
        if (! array_key_exists('procedure_code', $d) || $d['procedure_code'] === $p->procedure_code) {
            $d += ['treat_area' => $p->treat_area];
        }
        $d += $p->only(['status', ...self::CORRECTABLE]);
        if ($d['status'] === ProcedureStatus::EXTERNAL && $p->status === ProcedureStatus::EXTERNAL) { // still external: keep unsent fields
            $d += ['external_clinic_name' => $p->external_clinic_name,
                'external_date' => ApproxDate::format($p->external_date, $p->external_date_precision)];
        }

        return $d;
    }

    /** Validated columns, or an error response. */
    private static function attributes(array $d, Visit $visit, TenancyDirectory $tenancy, ?string $self = null): array|JsonResponse
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
        $ext = self::external($d, $loc, $visit, $tenancy, $self);
        if (! is_array($ext)) {
            return $ext;
        }
        $dx = $d['diagnosis_code'] ?? null;

        return [...$loc, ...$ext, 'status' => $d['status'], 'procedure_code' => $code, 'variant' => $d['variant'] ?? 'standar', 'provider_id' => $provider,
            // a code set through the API without a source is `manual`; no code = no source
            'diagnosis_code' => $dx, 'diagnosis_source' => $dx === null ? null : ($d['diagnosis_source'] ?? 'manual')];
    }

    /**
     * External columns (all null unless status is external). External needs clinic name + approximate date, may not sit on a site with
     * `selesai` work that day (422 external_same_surface, never overridable) and waits for confirmation when the patient has `selesai`
     * work that day elsewhere in the mouth (`pending`); otherwise it is active at once (`not_required`: initial exam, history, ERM).
     */
    private static function external(array $d, array $loc, Visit $visit, TenancyDirectory $tenancy, ?string $self): array|JsonResponse
    {
        $name = trim((string) ($d['external_clinic_name'] ?? ''));
        $date = trim((string) ($d['external_date'] ?? ''));
        $none = array_fill_keys(['external_clinic_name', 'external_date', 'external_date_precision', 'external_confirmation',
            'external_confirmed_by', 'external_confirmed_at', 'external_confirmation_reason'], null);
        if ($d['status'] !== ProcedureStatus::EXTERNAL) {
            $f = $name !== '' ? 'external_clinic_name' : ($date !== '' ? 'external_date' : null);

            return $f ? self::invalid($f, 'Nama klinik dan tanggal perkiraan hanya untuk status klinik lain.') : $none;
        }
        if ($name === '') {
            return self::invalid('external_clinic_name', 'Nama klinik lain wajib.');
        }
        if ($date === '') {
            return self::invalid('external_date', 'Tanggal perkiraan wajib (tahun, bulan/tahun, atau tanggal lengkap).');
        }
        [$parsed, $e] = ApproxDate::parse($date, CarbonImmutable::now(self::tz($visit, $tenancy)));
        if ($e) {
            return self::invalid('external_date', $e);
        }
        if ($bad = self::sameSite($loc, $visit, $tenancy, $self, $today)) {
            return $bad;
        }

        return ['external_clinic_name' => $name, 'external_date' => $parsed[0], 'external_date_precision' => $parsed[1],
            'external_confirmation' => $today->isEmpty() ? 'not_required' : 'pending'] + $none;
    }

    /** 422 when $site overlaps a `selesai` procedure (draft or final) of this patient on the visit's local day; $today = those rows. */
    private static function sameSite(array $site, Visit $visit, TenancyDirectory $tenancy, ?string $self, ?Collection &$today = null): ?JsonResponse
    {
        $day = CarbonImmutable::parse($visit->started_at ?? now())->setTimezone(self::tz($visit, $tenancy));
        $today = ProcedureRecord::where('patient_id', $visit->patient_id)->where('status', ProcedureStatus::BILLABLE)
            ->whereIn('state', ['draft', 'final'])->when($self, fn ($q) => $q->where('id', '!=', $self))
            ->whereIn('visit_id', Visit::where('patient_id', $visit->patient_id)
                ->whereBetween('started_at', [$day->startOfDay()->utc(), $day->endOfDay()->utc()])->select('id'))->get();
        if ($today->contains(fn ($p) => ProcedureSite::overlaps($site, $p->only(['treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch'])))) {
            $m = 'Gigi/permukaan ini sudah dikerjakan (selesai) hari ini di klinik ini; tidak bisa dicatat sebagai pekerjaan klinik lain.';

            return response()->json(['error' => 'external_same_surface', 'message' => $m, 'errors' => ['tooth' => [$m]]], 422);
        }

        return null;
    }

    private static function tz(Visit $visit, TenancyDirectory $tenancy): string
    {
        return $tenancy->branchOrFail($visit->branch_id)['timezone'] ?: 'Asia/Jakarta';
    }

    /** No fee, ever: clinic + date + precision + confirmation state only. */
    private static function externalAudit(ProcedureRecord $p): array
    {
        return $p->status !== ProcedureStatus::EXTERNAL ? [] : ['external_clinic_name' => $p->external_clinic_name,
            'external_date' => substr((string) $p->external_date, 0, 10), 'external_date_precision' => $p->external_date_precision,
            'external_confirmation' => $p->external_confirmation];
    }

    private static function invalid(string $field, string $m): JsonResponse
    {
        return response()->json(['message' => $m, 'errors' => [$field => [$m]]], 422);
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
