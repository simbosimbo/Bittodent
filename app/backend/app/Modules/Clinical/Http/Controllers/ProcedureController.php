<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\ApproxDate;
use App\Modules\Clinical\Domain\OdontogramTaxonomy;
use App\Modules\Clinical\Domain\ProcedureCatalog;
use App\Modules\Clinical\Domain\ProcedureLocation;
use App\Modules\Clinical\Domain\ProcedureSite;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Events\ProcedureCorrected;
use App\Modules\Clinical\Events\ProcedureRecorded;
use App\Modules\Clinical\Http\Requests\ProcedureHistoryRequest;
use App\Modules\Clinical\Http\Requests\ProcedureRequest;
use App\Modules\Clinical\Models\ProcedureCorrection;
use App\Modules\Clinical\Models\ProcedureCorrectionDecision;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\CodingSuggestions;
use App\Modules\Clinical\Services\PatientCareSync;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Tenancy\Contracts\DentistProfileDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\OfficialIcdCode;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Treatments (procedure_record). Drafts are editable/discardable by their author until the visit is signed; signing finalizes them
// (NoteController::selesai). A status change on a final row = new final row superseding it. Only `selesai` + code bills (ProcedureRecorded).
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
            $dup = self::duplicateOf($attrs, $visit);
            if ($dup && ! ($d['confirm_duplicate'] ?? false)) {
                return self::duplicate($dup);
            }
            $p = ProcedureRecord::create([...$attrs, 'patient_id' => $visit->patient_id, 'visit_id' => $visit->id, 'state' => 'draft',
                'source' => $d['source'] ?? 'manual', 'created_by' => $ctx->userId]);
            Audit::log('buat', 'procedure_record', $p->id, ['tooth' => $p->tooth, 'surfaces' => $p->surfaces, ...self::externalAudit($p),
                ...($dup ? ['duplicate_of' => $dup->id] : [])]);

            return response()->json(self::out($p), 201);
        });
    }

    /**
     * POST /api/visits/{id}/tooth-entries (odontogram v2, board 09): tooth -> condition/procedure -> surfaces -> status -> Simpan as ONE
     * draft procedure row. Dentist only (route perm note.sign; assistants keep the draft procedure endpoint). Vocabulary comes from
     * OdontogramTaxonomy (resources/odontogram/taxonomy.json): v2 status => procedure status, V => stored B, group => treat area.
     * A bridge is one range row (tooth_range "34-36") with the role per tooth and the material. The usual location, provider, external
     * and signed-visit rules apply (same attributes() as store()); a `selesai` row with a tariffed code bills on Selesai as before.
     * Procedure first (S3): {tooth, procedure_code, status} without a condition takes the condition from the code's catalog mapping
     * (one => it, several => 422 pick_condition, none => no odontogram symbol).
     */
    public function storeEntry(Request $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validate(self::entryRules());
        $prep = self::prepareEntry($d);
        if (! is_array($prep)) {
            return $prep;
        }
        $ctx = Ctx::current();

        return DB::transaction(function () use ($prep, $d, $id, $tenancy) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            if ($e = self::entryVisitError($visit)) {
                return $e;
            }
            $r = self::insertEntry($prep, $d, $visit, $tenancy);

            return $r instanceof ProcedureRecord ? response()->json(self::out($r), 201) : $r;
        });
    }

    /**
     * POST /api/visits/{id}/tooth-entries/batch {entries: [...]} (board OVv2-06, Pemeriksaan awal): palette mode, many teeth, ONE Simpan.
     * All or nothing. Status Ada sebelumnya / Rencana only: an exam records the mouth, it never bills (Selesai stays in Perawatan).
     */
    public function storeEntries(Request $request, string $id, TenancyDirectory $tenancy)
    {
        $rules = ['entries' => ['required', 'array', 'min:1', 'max:64']];
        foreach (self::entryRules('entries.*.') as $k => $r) {
            $rules['entries.*.'.$k] = $k === 'status' ? ['required', 'string', 'in:ada_sebelumnya,rencana'] : $r;
        }
        $all = $request->validate($rules)['entries'];
        $prepared = [];
        foreach ($all as $i => $d) {
            $prep = self::prepareEntry($d);
            if (! is_array($prep)) {
                return response()->json(['message' => 'Gigi '.$d['tooth'].': '.($prep->getData(true)['message'] ?? 'tidak valid.'), 'index' => $i,
                    'errors' => $prep->getData(true)['errors'] ?? []], 422);
            }
            $prepared[] = [$prep, $d];
        }

        return DB::transaction(function () use ($prepared, $id, $tenancy) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            if ($e = self::entryVisitError($visit)) {
                return $e;
            }
            $out = [];
            foreach ($prepared as [$prep, $d]) {
                $r = self::insertEntry($prep, $d, $visit, $tenancy);
                if (! $r instanceof ProcedureRecord) {
                    throw new HttpResponseException($r); // rolls the whole Simpan back
                }
                $out[] = self::out($r);
            }

            return response()->json(['created' => count($out), 'entries' => $out], 201);
        });
    }

    /** Validation of one tooth entry (shared by the single and the batch endpoint; $at = the entry's path prefix). */
    private static function entryRules(string $at = ''): array
    {
        $tax = OdontogramTaxonomy::class;

        return [
            'tooth' => ['required', 'integer', 'in:'.implode(',', $tax::teeth())],
            // "tindakan dulu": a procedure without a condition takes it from the catalog mapping (prepareEntry)
            'condition' => ['required_without:'.$at.'procedure_code', 'nullable', 'string', 'in:'.implode(',', array_keys($tax::conditions()))],
            'status' => ['required', 'string', 'in:'.implode(',', $tax::statuses())],
            'surfaces' => ['sometimes', 'array', 'max:5'],
            'surfaces.*' => ['string', 'in:M,O,I,D,V,L'],
            'procedure_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD9CM, OfficialIcdCode::icd9cm()],
            'variant' => ['sometimes', 'nullable', 'string', 'regex:/^[a-z0-9_]{1,10}$/'], // price level / stage (S2); unknown => waits for a price (S1)
            'diagnosis_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD10, OfficialIcdCode::icd10()],
            'span_to' => ['sometimes', 'nullable', 'integer', 'in:'.implode(',', $tax::teeth())],
            'span_roles' => ['sometimes', 'nullable', 'array'],
            'span_roles.*' => ['string', 'in:'.implode(',', $tax::spanRoles())],
            'material' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', $tax::materials())],
            'external_clinic_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'external_date' => ['sometimes', 'nullable', 'string', 'max:10'],
            'confirm_duplicate' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * A billable row about to double-bill: a current `selesai` row of this visit with the same code on the same site (tooth, range,
     * quadrant, arch; overlapping surfaces). 36 O then 36 D is two fillings, not a duplicate. Only `selesai` bills, so only it counts.
     */
    private static function duplicateOf(array $attrs, Visit $visit): ?ProcedureRecord
    {
        if ($attrs['status'] !== ProcedureStatus::BILLABLE) {
            return null;
        }
        $overlap = fn (?string $a, ?string $b) => $a === null || $b === null || array_intersect(str_split($a), str_split($b)) !== [];

        return ProcedureRecord::where('visit_id', $visit->id)->whereIn('state', ['draft', 'final'])->where('status', ProcedureStatus::BILLABLE)
            ->where('procedure_code', $attrs['procedure_code'])->whereNotIn('id', ProcedureRecord::whereNotNull('supersedes_id')->select('supersedes_id'))
            ->where('tooth', $attrs['tooth'])->where('tooth_range', $attrs['tooth_range'])->where('quadrant', $attrs['quadrant'])->where('arch', $attrs['arch'])
            ->get()->first(fn (ProcedureRecord $p) => $overlap($p->surfaces, $attrs['surfaces']));
    }

    private static function duplicate(ProcedureRecord $dup): JsonResponse
    {
        $def = ProcedureDefinition::where('procedure_code', $dup->procedure_code)->first();
        $site = match (true) {
            $dup->tooth !== null => 'di gigi '.$dup->tooth.($dup->surfaces ? ' '.$dup->surfaces : ''),
            $dup->tooth_range !== null => 'di gigi '.$dup->tooth_range,
            $dup->quadrant !== null => 'di kuadran '.$dup->quadrant,
            $dup->arch !== null => 'di rahang '.$dup->arch,
            default => '',
        };

        return response()->json(['error' => 'duplicate_procedure', 'existing_id' => $dup->id,
            'message' => trim(($def?->layman ?? $def?->name ?? $dup->procedure_code).' sudah dicatat '.$site).' pada kunjungan ini. Tambahkan lagi?'], 409);
    }

    /** Taxonomy, span, code and diagnosis checks of one entry: [$p, $roles] or a 422. */
    private static function prepareEntry(array $d): array|JsonResponse
    {
        $tax = OdontogramTaxonomy::class;
        $bad = fn (string $f, string $m) => response()->json(['message' => $m, 'errors' => [$f => [$m]]], 422);
        $sentCode = $d['procedure_code'] ?? null;
        if ($sentCode !== null) {
            $def = ProcedureDefinition::where('procedure_code', $sentCode)->first();
            if (! $def) {
                return $bad('procedure_code', 'Tindakan ini belum ada di katalog tindakan klinik. Minta pemilik menambahkannya di Pengaturan > Harga.');
            }
            $keys = array_keys(array_filter($tax::conditions(), fn ($c) => $c['code'] !== null && in_array($c['code'], $def->conditions ?? [], true)));
            if (isset($d['condition']) && ! in_array($d['condition'], $keys, true)) {
                return $bad('procedure_code', 'Kode tindakan bukan salah satu yang dipetakan untuk kondisi ini.');
            }
            if (! isset($d['condition']) && count($keys) > 1) {
                return response()->json(['error' => 'pick_condition', 'message' => 'Pilih bahan / jenis yang dipakai.', 'candidates' => $keys,
                    'errors' => ['condition' => ['Pilih salah satu bahan / jenis.']]], 422);
            }
            $d['condition'] ??= $keys[0] ?? null; // empty mapping (kontrol, trepanasi): the procedure alone, no odontogram symbol
        }
        $cond = ($d['condition'] ?? null) === null ? null : $tax::condition($d['condition']);
        $span = ($cond['group'] ?? null) === 'span';
        if ($span && empty($d['span_to'])) {
            return $bad('span_to', 'Rentang wajib: ketuk gigi akhir rentang.');
        }
        if (! $span && (isset($d['span_to']) || isset($d['span_roles']) || isset($d['material']))) {
            return $bad('span_to', 'Rentang hanya untuk kondisi rentang (bridge).');
        }
        $surfs = array_map(fn ($s) => $tax::storedSurface($s), $d['surfaces'] ?? []);
        // "Tindakan dulu": a finished entry bills the clinic code mapped to its condition (Pengaturan > Harga), never a typed guess.
        if ($d['status'] === 'selesai' && $sentCode === null) {
            $codes = $cond['code'] ? ProcedureCatalog::codesFor($cond['code']) : [];
            if ($codes === []) {
                return $bad('condition', "Kondisi {$cond['label']} ({$cond['code']}) belum dipetakan ke tindakan klinik, jadi tidak bisa ditagih. Minta pemilik memetakannya di Pengaturan > Harga.");
            }
            if (count($codes) > 1) {
                return response()->json(['error' => 'pick_code', 'message' => 'Pilih tindakan yang dikerjakan.', 'candidates' => ProcedureDefinition::whereIn('procedure_code', $codes)
                    ->orderBy('procedure_code')->get(['procedure_code', 'name'])->map->only(['procedure_code', 'name'])->values(),
                    'errors' => ['procedure_code' => ['Pilih salah satu tindakan.']]], 422);
            }
            $d['procedure_code'] = $codes[0];
        }
        // diagnosis: what the dentist sent, else the clinic rule paired with the billed code on this tooth (editable before Selesai)
        $dx = $d['diagnosis_code'] ?? null;
        $dxSource = $dx === null ? null : 'manual';
        if ($dx === null && ($d['procedure_code'] ?? null) && ($dx = CodingSuggestions::forProcedure($d['procedure_code'], $d['tooth'], Ctx::current()->userId))) {
            $dxSource = 'aturan';
        }
        $p = ['condition' => $d['condition'], 'diagnosis_code' => $dx, 'diagnosis_source' => $dxSource, 'status' => $tax::procedureStatus($d['status']), 'procedure_code' => $d['procedure_code'] ?? null, 'variant' => $d['variant'] ?? null,
            'external_clinic_name' => $d['external_clinic_name'] ?? null, 'external_date' => $d['external_date'] ?? null];
        $roles = null;
        if ($span) {
            $upper = fn (int $t) => in_array(intdiv($t, 10), [1, 2, 5, 6], true);
            if ($upper($d['tooth']) !== $upper($d['span_to'])) {
                return $bad('span_to', 'Rentang harus pada satu rahang.');
            }
            $p += ['tooth_range' => "{$d['tooth']}-{$d['span_to']}"];
            $roles = $d['span_roles'] ?? null;
            foreach (array_keys($roles ?? []) as $t) {
                if (! in_array((int) $t, $tax::teeth(), true)) {
                    return $bad('span_roles', 'Peran rentang hanya untuk nomor gigi FDI.');
                }
            }
        } else {
            $p += ['tooth' => $d['tooth'], 'surfaces' => $surfs ?: null];
        }
        if ($p['procedure_code'] === null) {
            $p['treat_area'] = $cond['group'] === 'surface' ? 'surface' : $tax::area($cond['group']);
        }

        return [$p, $roles];
    }

    private static function entryVisitError(Visit $visit): ?JsonResponse
    {
        if (! Ctx::current()->coversBranch($visit->branch_id)) {
            return Audit::denied('branch:'.$visit->branch_id);
        }

        return $visit->isSigned() ? self::locked() : null;
    }

    private static function insertEntry(array $prep, array $d, Visit $visit, TenancyDirectory $tenancy): ProcedureRecord|JsonResponse
    {
        [$p, $roles] = $prep;
        $ctx = Ctx::current();
        $attrs = self::attributes($p, $visit, $tenancy);
        if (! is_array($attrs)) {
            return $attrs;
        }
        $dup = self::duplicateOf($attrs, $visit);
        if ($dup && ! ($d['confirm_duplicate'] ?? false)) {
            return self::duplicate($dup);
        }
        $r = ProcedureRecord::create([...$attrs, 'patient_id' => $visit->patient_id, 'visit_id' => $visit->id, 'state' => 'draft',
            'source' => 'manual', 'created_by' => $ctx->userId, 'condition' => $p['condition'],
            'span_roles' => $roles ?: null, 'material' => $d['material'] ?? null]);
        Audit::log('buat', 'procedure_record', $r->id, ['entry' => 'odontogram_v2', 'tooth' => $r->tooth, 'tooth_range' => $r->tooth_range,
            'surfaces' => $r->surfaces, 'condition' => $p['condition'], 'status' => $r->status, ...self::externalAudit($r),
            ...($dup ? ['duplicate_of' => $dup->id] : [])]);

        return $r;
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
            $p->update([...$attrs, 'source' => $d['source'] ?? $p->source, 'approved_by' => null, 'approved_at' => null]); // edited draft: Setujui again (#55)
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
            if ($d['to'] === ProcedureStatus::BILLABLE && $p->procedure_code === null) {
                return self::needsCode();
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
            app(PatientCareSync::class)->push($new->patient_id);

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
            app(PatientCareSync::class)->push($new->patient_id);

            return response()->json(['replaced' => self::out($marker), 'procedure' => self::out($new)], 201);
        });
    }

    /**
     * POST /api/procedures/{id}/corrections {reason_type, reason, code/site/diagnosis/variant/provider/external fields}: dentist only
     * (note.sign). DEVIATIONS #53. Always writes a procedure_correction. Within the tenant window (hours since the correction chain's
     * finalized_at, see anchor()) it is applied at once: new final row superseding the old one (same status, or `tidak_dikerjakan`),
     * 201 + the new row. Outside: 202 pending, the owner decides (decideCorrection). Never bills: the old invoice_line stays on the
     * old procedure; ProcedureCorrected is for Billing (unit B). Genuine re-work is /replace, not this.
     */
    public function correct(ProcedureHistoryRequest $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validated();
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx, $tenancy) {
            $p = ProcedureRecord::lockForUpdate()->where('state', 'final')->findOrFail($id);
            if ($e = self::notCurrent($p)) {
                return $e;
            }
            $visit = Visit::lockForUpdate()->findOrFail($p->visit_id);
            if (! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            if ($p->status === ProcedureStatus::NOT_DONE) {
                return response()->json(['error' => 'not_correctable', 'message' => 'Tindakan yang sudah dinyatakan tidak dikerjakan tidak bisa dikoreksi lagi.'], 409);
            }
            if ($d['reason_type'] === ProcedureStatus::NOT_DONE && $p->status !== ProcedureStatus::BILLABLE) {
                return response()->json(['error' => 'not_done_requires_selesai', 'message' => 'Hanya tindakan berstatus selesai yang bisa dinyatakan tidak dikerjakan.'], 409);
            }
            if (ProcedureCorrection::where('procedure_id', $p->id)->whereDoesntHave('decision')->exists()) {
                return response()->json(['error' => 'correction_pending', 'message' => 'Masih ada koreksi tindakan ini yang menunggu persetujuan pemilik.'], 409);
            }
            $proposed = $d['reason_type'] === ProcedureStatus::NOT_DONE ? null : array_diff_key($d, array_flip(['reason', 'reason_type']));
            $attrs = self::correctedAttributes($p, $d['reason_type'], $proposed, $visit, $tenancy);
            if (! is_array($attrs)) {
                return $attrs;
            }
            $hours = $tenancy->correctionWindowHours();
            $within = now()->lessThanOrEqualTo(self::anchor($p)->addHours($hours));
            $c = ProcedureCorrection::create(['procedure_id' => $p->id, 'reason_type' => $d['reason_type'], 'proposed' => $proposed,
                'reason_enc' => Crypto::encrypt($d['reason']), 'requested_by' => $ctx->userId, 'within_window' => $within]);
            Audit::log('koreksi_tindakan.diajukan', 'procedure_correction', $c->id, ['procedure_id' => $p->id, 'reason_type' => $c->reason_type,
                'within_window' => $within, 'window_hours' => $hours]);
            if (! $within) {
                return response()->json(['approval' => 'pending', 'correction_id' => $c->id, 'window_hours' => $hours], 202);
            }
            $new = self::applyCorrection($c, $p, $attrs, $d['reason']);
            ProcedureCorrectionDecision::create(['correction_id' => $c->id, 'decision' => 'diterapkan', 'decided_by' => $ctx->userId,
                'result_procedure_id' => $new->id]);

            return response()->json(self::out($new) + ['approval' => 'not_needed', 'correction_id' => $c->id], 201);
        });
    }

    /**
     * GET /api/procedure-corrections/pending: owner (correction.approve). Corrections waiting for a decision in the owner's branches,
     * with the old row and the proposal. Read is audited (the reason may be clinical text).
     */
    public function pendingCorrections(UserDirectory $users)
    {
        $ctx = Ctx::current();
        $rows = ProcedureCorrection::whereDoesntHave('decision')->orderBy('created_at')->orderBy('id')->get();
        $procs = ProcedureRecord::whereIn('id', $rows->pluck('procedure_id'))->get()->keyBy('id');
        $branch = Visit::whereIn('id', $procs->pluck('visit_id'))->pluck('branch_id', 'id');
        $rows = $rows->filter(fn ($c) => $ctx->coversBranch($branch[$procs[$c->procedure_id]->visit_id]))->values();
        $names = collect($users->namesByIds($rows->pluck('requested_by')->unique()->values()->all()))->pluck('name', 'id');
        Audit::log('baca', 'procedure_correction', null, ['pending' => $rows->count()]);

        return response()->json($rows->map(fn ($c) => ['id' => $c->id, 'reason_type' => $c->reason_type, 'reason' => $c->reason(),
            'proposed' => $c->proposed, 'requested_by' => ['id' => $c->requested_by, 'name' => $names[$c->requested_by] ?? null],
            'created_at' => $c->created_at, 'procedure' => self::out($procs[$c->procedure_id])]));
    }

    /**
     * POST /api/procedure-corrections/{id}/approve|reject {reason?}: owner (correction.approve), once per pending correction.
     * Approve re-checks the old row is still current and the proposal still valid (else 409/422, still pending), then applies it.
     * Conflict of interest as unit 4: an owner who requested it or performed the work may approve only as sole active owner,
     * flagged self_approved_sole_owner. Reject changes no procedure row.
     */
    public function decideCorrection(Request $request, string $id, string $decision, TenancyDirectory $tenancy)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $decision, $tenancy, $me) {
            $c = ProcedureCorrection::findOrFail($id); // append-only (no UPDATE grant = no locking read); the procedure lock + unique decision serialize
            $p = ProcedureRecord::lockForUpdate()->findOrFail($c->procedure_id);
            $visit = Visit::lockForUpdate()->findOrFail($p->visit_id);
            if (! Ctx::current()->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            if (ProcedureCorrectionDecision::where('correction_id', $c->id)->exists()) {
                return response()->json(['error' => 'not_pending', 'message' => 'Koreksi ini sudah diputuskan.'], 409);
            }
            $new = null;
            $self = false;
            if ($decision === 'disetujui') {
                if ($e = self::notCurrent($p)) {
                    return $e;
                }
                $attrs = self::correctedAttributes($p, $c->reason_type, $c->proposed, $visit, $tenancy);
                if (! is_array($attrs)) {
                    return $attrs;
                }
                $self = in_array($me, [$c->requested_by, $p->provider_id, $attrs['provider_id']], true);
                if ($self && array_diff($tenancy->activeUserIdsWithRole('owner'), [$me]) !== []) {
                    Audit::log('koreksi_tindakan.konflik', 'procedure_correction', $c->id, ['procedure_id' => $p->id]);

                    return response()->json(['error' => 'conflict_of_interest',
                        'message' => 'Anda terlibat dalam tindakan atau koreksi ini. Persetujuan harus oleh pemilik lain.'], 403);
                }
                $new = self::applyCorrection($c, $p, $attrs, $c->reason(), $c->requested_by);
            }
            ProcedureCorrectionDecision::create(['correction_id' => $c->id, 'decision' => $decision, 'decided_by' => $me,
                'reason' => $d['reason'] ?? null, 'result_procedure_id' => $new?->id, 'self_approved_sole_owner' => $self]);
            Audit::log('koreksi_tindakan.'.$decision, 'procedure_correction', $c->id, ['procedure_id' => $p->id, 'reason_type' => $c->reason_type,
                'result_procedure_id' => $new?->id, 'self_approved_sole_owner' => $self]);

            return response()->json(['id' => $c->id, 'decision' => $decision, 'self_approved_sole_owner' => $self,
                'procedure' => $new ? self::out($new) : null]);
        });
    }

    /** Columns of the corrected row, or an error response. `tidak_dikerjakan` = copy of the old row with that status. */
    private static function correctedAttributes(ProcedureRecord $p, string $type, ?array $proposed, Visit $visit, TenancyDirectory $tenancy): array|JsonResponse
    {
        if ($type === ProcedureStatus::NOT_DONE) {
            return [...$p->only([...self::COPY, 'provider_id']), 'status' => ProcedureStatus::NOT_DONE];
        }
        $attrs = self::attributes(self::merged($proposed ?? [], $p), $visit, $tenancy, $p->id);
        if (is_array($attrs) && $p->status === ProcedureStatus::EXTERNAL) { // already confirmed or never needed it: a correction does not re-open that
            $attrs = [...$attrs, ...$p->only(['external_confirmation', 'external_confirmed_by', 'external_confirmed_at', 'external_confirmation_reason'])];
        }

        return $attrs;
    }

    /** New final row superseding $p (never billed: no recorded()), audit + ProcedureCorrected for Billing (unit B). */
    private static function applyCorrection(ProcedureCorrection $c, ProcedureRecord $p, array $attrs, string $reason, ?string $author = null): ProcedureRecord
    {
        $ctx = Ctx::current();
        $new = ProcedureRecord::create([...$attrs, 'patient_id' => $p->patient_id, 'visit_id' => $p->visit_id, 'state' => 'final',
            'source' => 'manual', 'supersedes_id' => $p->id, 'replaces_id' => $p->replaces_id, 'reason' => $reason,
            'created_by' => $author ?? $ctx->userId, 'finalized_by' => $ctx->userId, 'finalized_at' => now()]);
        Audit::log('koreksi_tindakan.diterapkan', 'procedure_record', $new->id, ['supersedes' => $p->id, 'correction_id' => $c->id,
            'reason_type' => $c->reason_type, 'fields' => array_values(array_filter([...self::CORRECTABLE, 'status'], fn ($f) => (string) $new->$f !== (string) $p->$f))]);
        $billable = $new->status === ProcedureStatus::BILLABLE && $new->procedure_code !== null ? self::billingEvent($new) : null;
        event(new ProcedureCorrected($ctx->tenant(), $c->id, $p->id, $new->id, $c->reason_type,
            array_map(fn ($r) => $r->id, $p->correctionChain()), $billable));
        app(PatientCareSync::class)->push($new->patient_id);

        return $new;
    }

    /**
     * Correction window anchor: finalized_at of the first row of $p's correction chain (walk back over rows written by a correction,
     * i.e. with a reason and not a replace marker), so correcting a correction does not restart the window. A status change
     * (e.g. direncanakan -> selesai) is a new act and starts its own window.
     */
    private static function anchor(ProcedureRecord $p): CarbonImmutable
    {
        $root = $p->correctionChain()[0];

        return CarbonImmutable::parse($root->finalized_at ?? $root->created_at);
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
        event(self::billingEvent($p));
    }

    private static function billingEvent(ProcedureRecord $p): ProcedureRecorded
    {
        $profile = app(DentistProfileDirectory::class)->of($p->provider_id);

        return new ProcedureRecorded(Ctx::current()->tenant(), $p->visit_id, $p->procedure_code, $p->variant,
            $p->tooth === null ? null : (string) $p->tooth, $p->id, $p->provider_id, $profile['category'], $profile['field'], $p->surfaces);
    }

    /** Chart / API shape. $defs = catalog rows keyed by code (pass for lists to avoid one query per row). */
    public static function out(ProcedureRecord $p, ?Collection $defs = null): array
    {
        $def = $p->procedure_code === null ? null
            : ($defs ? $defs->get($p->procedure_code) : ProcedureDefinition::where('procedure_code', $p->procedure_code)->first());

        return $p->only(['id', 'visit_id', 'patient_id', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch', 'status',
            'procedure_code', 'variant', 'diagnosis_code', 'diagnosis_source', 'provider_id', 'state', 'source', 'approved_at', 'supersedes_id', 'reason', 'replaces_id',
            'created_by', 'finalized_by', 'finalized_at', 'condition', 'span_roles', 'material', 'external_clinic_name', 'external_date_precision', 'external_confirmation',
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

    /**
     * A finished procedure without an ICD-9-CM code can never be billed (no tariff line, no invoice): the patient would leave
     * without paying while the screen says "antrean bayar" (E2E 16-11-2026). Code is required for `selesai`.
     */
    private static function needsCode(): JsonResponse
    {
        return response()->json(['message' => 'Tindakan selesai wajib punya kode ICD-9-CM agar masuk tagihan. Ketuk tindakan cepat (mis. Tambal) atau isi kodenya.',
            'errors' => ['procedure_code' => ['Wajib untuk tindakan selesai.']]], 422);
    }

    /** Validated columns, or an error response. */
    private static function attributes(array $d, Visit $visit, TenancyDirectory $tenancy, ?string $self = null): array|JsonResponse
    {
        $code = $d['procedure_code'] ?? null;
        if ($d['status'] === ProcedureStatus::BILLABLE && $code === null) {
            return self::needsCode();
        }
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
        if (! array_key_exists('diagnosis_code', $d) && $d['status'] === ProcedureStatus::BILLABLE && $code !== null) {
            // not sent at all (explicit null = cleared on purpose): the clinic rule paired with the billed code, as for tooth entries
            if ($dx = CodingSuggestions::forProcedure($code, isset($d['tooth']) ? (int) $d['tooth'] : null, Ctx::current()->userId)) {
                $d['diagnosis_source'] = 'aturan';
            }
        }

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
