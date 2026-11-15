<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\SelesaiSignature;
use App\Modules\Clinical\Domain\SignCheck;
use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Http\Requests\CorrectionRequestBody;
use App\Modules\Clinical\Http\Requests\SaveNoteRequest;
use App\Modules\Clinical\Http\Requests\SelesaiRequest;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\CorrectionRequest;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\VisitCloser;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Integrations\Contracts\OutboxPublisher;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// SOAP draft -> Selesai (DPJP: tanda tangan + tutup, #54) -> corrections (new version; >2x24h via correction_request, D-013).
class NoteController extends Controller
{
    private const FREE_EDIT_HOURS = 48; // Permenkes 24/2022 Pasal 30 ayat 6; counted from v1 signed_at (dasar hukum klinis perlu dicek)

    public function __construct(private OutboxPublisher $outbox) {}

    /** PUT /api/visits/{id}/note: create/update the draft (version 1). Stale revision => 409; signed => 409. */
    public function save(SaveNoteRequest $request, string $id)
    {
        $d = $request->validated();
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $me) {
            $visit = Visit::lockForUpdate()->findOrFail($id); // serializes concurrent first saves
            if (! Ctx::current()->coversBranch($visit->branch_id)) {
                return Audit::denied('branch:'.$visit->branch_id);
            }
            $note = ClinicalNote::where('visit_id', $id)->orderBy('created_at')->first();
            $draft = $note?->versions->firstWhere('state', 'draft');
            if ($note && ! $draft) {
                return self::conflict('signed', 'Catatan sudah ditandatangani; perubahan lewat koreksi.');
            }
            if ($draft && ($d['revision'] ?? null) !== $draft->revision) {
                return self::conflict('stale', 'Catatan sudah diubah orang lain. Muat ulang dulu.', ['revision' => $draft->revision]);
            }
            // Author = the visit's responsible dentist (also when an assistant writes the draft).
            $note ??= ClinicalNote::create(['visit_id' => $id, 'patient_id' => $visit->patient_id,
                'author_id' => $visit->dentist_id, 'first_input_at' => now()]);
            $draft ??= new ClinicalNoteVersion(['note_id' => $note->id, 'version' => 1, 'revision' => 0, 'state' => 'draft', 'created_by' => $me]);
            $draft->setSoap($d['soap'])->fill(['source' => $d['source'] ?? 'manual', 'revision' => $draft->revision + 1, 'approved_by' => null, 'approved_at' => null])->save();
            Audit::log($draft->revision === 1 ? 'buat' : 'ubah', 'clinical_note_version', $draft->id, ['revision' => $draft->revision]);

            return response()->json(['note_id' => $note->id, 'version_id' => $draft->id, 'revision' => $draft->revision,
                'source' => $draft->source, 'content_hash' => $draft->content_hash]);
        });
    }

    /**
     * POST /api/visits/{id}/selesai {revision, confirm: true, pin?, accept_warnings?, reason?} (DEVIATIONS #54): Selesai = tanda tangan
     * elektronik + tutup kunjungan in one idempotent action, only by the visit's dentist (DPJP = visit.dentist_id = note author).
     * Order: DPJP -> confirm (403) -> PIN when the clinic requires it (403 / 422 pin_not_set) -> revision (409) -> unapproved agent
     * drafts (422) -> SignCheck (422) -> sign + close in a savepoint; a close refusal (409 invoice_required, 422 reason) rolls the
     * signature back, so the note stays a draft. Second press after sign + close = 200 with the same signature.
     */
    public function selesai(SelesaiRequest $request, string $id, UserDirectory $users, TenancyDirectory $tenancy, VisitCloser $closer)
    {
        $ctx = Ctx::current();

        return DB::transaction(function () use ($request, $id, $users, $tenancy, $closer, $ctx) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            $note = ClinicalNote::where('visit_id', $id)->orderBy('created_at')->first();
            if ($visit->dentist_id !== $ctx->userId || ($note && $note->author_id !== $ctx->userId) || ! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('visit.dpjp');
            }
            if (! $request->confirmed()) {
                Audit::log('tanda_tangan_ditolak', 'visit', $id, ['why' => 'konfirmasi']);

                return response()->json(['error' => 'confirmation_required', 'message' => 'Centang pernyataan sebelum menekan Selesai.'], 403);
            }
            $draft = $note?->versions->firstWhere('state', 'draft');
            $signed = $note ? SelesaiSignature::signedVersion($note) : null;
            if (! $draft) {
                if (! $signed) {
                    return self::conflict('no_draft', 'Belum ada catatan. Tulis catatan SOAP dulu.');
                }
                if ($visit->status !== 'berlangsung') { // idempotent second press
                    return response()->json([...SelesaiSignature::payload($signed, $id), 'visit' => VisitController::out($visit)]);
                }
                // signed earlier but still open (pre-#54 / race): close only, still under the invoice guard
                if ($error = $closer->close($visit, null, 'selesai')) {
                    return $error;
                }

                return response()->json([...SelesaiSignature::payload($signed, $id), 'visit' => VisitController::out($visit)]);
            }
            if ($visit->status !== 'berlangsung') {
                return self::conflict('visit_closed', 'Kunjungan sudah ditutup.');
            }
            if ($tenancy->selesaiPinRequired()) {
                $pin = $users->verifySelesaiPin($ctx->userId, $request->pin(), 'selesai');
                if ($pin['result'] === 'no_pin') {
                    return response()->json(['error' => 'pin_not_set', 'message' => 'Klinik mewajibkan PIN saat Selesai. Atur PIN Anda dulu di Pengaturan RM.'], 422);
                }
                if ($pin['result'] !== 'ok') {
                    $locked = $pin['result'] !== 'wrong';

                    return response()->json(['error' => $locked ? 'pin_locked' : 'pin_wrong', 'locked_until' => $pin['locked_until'],
                        'message' => $locked ? 'PIN terkunci 15 menit karena 5 kali salah. Coba lagi nanti.' : 'PIN salah.'], 403);
                }
            }
            if ($request->integer('revision') !== $draft->revision) {
                return self::conflict('stale', 'Draf berubah sejak Anda membacanya. Periksa lagi sebelum Selesai.', ['revision' => $draft->revision]);
            }
            $pending = self::unapproved($id, $draft);
            if (array_merge(...array_values($pending))) {
                Audit::log('tanda_tangan_ditolak', 'clinical_note_version', $draft->id, ['why' => 'draf_ai']);

                return response()->json(['error' => 'unapproved_drafts', 'message' => 'Masih ada draf dari agen yang belum disetujui. Tekan Setujui dulu.',
                    ...$pending], 422);
            }
            $drafts = ToothFinding::where('visit_id', $id)->where('state', 'draft')->get();
            $procedures = ProcedureRecord::where('visit_id', $id)->where('state', 'draft')->orderBy('id')->get();
            $check = SignCheck::run($drafts, $procedures, $draft->soap(), $visit->patient_id);
            if ($check['blocks']) {
                Audit::log('tanda_tangan_ditolak', 'clinical_note_version', $draft->id, ['why' => 'validasi', 'rules' => array_column($check['blocks'], 'rule')]);

                return response()->json(['error' => 'sign_blocked', 'message' => 'Kode atau temuan tidak cocok. Perbaiki dulu sebelum Selesai.',
                    'blocks' => $check['blocks'], 'warnings' => $check['warnings']], 422);
            }
            $accepted = $check['warnings'] && $request->boolean('accept_warnings');
            if ($check['warnings'] && ! $accepted) {
                Audit::log('tanda_tangan_ditolak', 'clinical_note_version', $draft->id, ['why' => 'peringatan', 'rules' => array_column($check['warnings'], 'rule')]);

                return response()->json(['error' => 'warnings', 'message' => 'Ada peringatan. Periksa lagi, atau Selesai dengan alasan (accept_warnings + reason).',
                    'warnings' => $check['warnings']], 422);
            }
            try {
                return DB::transaction(fn () => $this->signAndClose($visit, $draft, $procedures, $closer,
                    $accepted ? ['warnings_accepted' => array_column($check['warnings'], 'rule'), 'reason' => $request->input('reason')] : []));
            } catch (HttpResponseException $e) { // close refused: signature rolled back with it (savepoint)
                Audit::log('tanda_tangan_ditolak', 'clinical_note_version', $draft->id, ['why' => 'tutup', 'error' => $e->getResponse()->getData(true)['error'] ?? null]);

                return $e->getResponse();
            }
        });
    }

    /** Inside a savepoint: lock drafts, bill, sign with the encounter hash, then close (throws the closer's refusal to roll back). */
    private function signAndClose(Visit $visit, ClinicalNoteVersion $draft, $procedures, VisitCloser $closer, array $warningAudit)
    {
        $me = Ctx::current()->userId;
        $now = now()->startOfSecond(); // stored precision: signed_at = finalized_at exactly (SelesaiSignature::recompute)
        $locked = ['state' => 'final', 'finalized_by' => $me, 'finalized_at' => $now];
        $findings = ToothFinding::where('visit_id', $visit->id)->where('state', 'draft')->update($locked);
        ProcedureRecord::where('visit_id', $visit->id)->where('state', 'draft')->update($locked);
        // billing: only procedures (never findings); recorded() bills `selesai` + code once (unique invoice_line.procedure_id)
        $procedures->each(fn ($p) => ProcedureController::recorded($p->forceFill($locked)));
        $v = SelesaiSignature::ATTESTATION_VERSION;
        $draft->forceFill(['content_hash' => Soap::hash($draft->soap()), 'state' => 'signed', 'signed_by' => $me, 'signed_at' => $now,
            'signature_hash' => SelesaiSignature::recompute($visit->id, $draft->soap(), $now),
            'attestation_version' => $v, 'attestation_text' => SelesaiSignature::ATTESTATIONS[$v]])->save();
        $this->outbox->enqueue('satusehat', 'satusehat:note_version:'.$draft->id, ['note_version_id' => $draft->id, 'visit_id' => $visit->id]);
        Audit::log('tanda_tangan', 'clinical_note_version', $draft->id, ['visit_id' => $visit->id, 'findings' => $findings,
            'procedures' => $procedures->count(), 'attestation_version' => $v, 'signature_hash' => $draft->signature_hash, ...$warningAudit]);
        if ($error = $closer->close($visit, null, 'selesai')) {
            throw new HttpResponseException($error);
        }

        return response()->json([...SelesaiSignature::payload($draft, $visit->id), 'findings_locked' => $findings,
            'procedures_locked' => $procedures->count(), 'visit' => VisitController::out($visit)]);
    }

    /** GET /api/visits/{id}/signature: who signed, when, the stored encounter hash and whether it still matches the stored rows. */
    public function signature(string $id)
    {
        $visit = Visit::findOrFail($id);
        $note = ClinicalNote::where('visit_id', $id)->orderBy('created_at')->first();
        $signed = $note ? SelesaiSignature::signedVersion($note) : null;
        if (! $signed) {
            return response()->json(['error' => 'not_signed', 'message' => 'Kunjungan ini belum Selesai.'], 404);
        }
        Audit::log('baca_tanda_tangan', 'visit', $visit->id);

        return response()->json(SelesaiSignature::payload($signed, $id));
    }

    /**
     * POST /api/visits/{id}/approve-drafts {ids?}: the DPJP explicitly approves ("Setujui") agent drafts (source ai_draft stays for
     * provenance). Without ids: every pending one on the visit. Any later edit of a draft clears its approval.
     */
    public function approveDrafts(Request $request, string $id)
    {
        $d = $request->validate(['ids' => ['sometimes', 'array', 'max:200'], 'ids.*' => ['uuid']]);
        $ctx = Ctx::current();

        return DB::transaction(function () use ($d, $id, $ctx) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            if ($visit->dentist_id !== $ctx->userId || ! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('visit.dpjp');
            }
            if ($visit->status !== 'berlangsung') {
                return self::conflict('visit_closed', 'Kunjungan sudah ditutup.');
            }
            $draft = ClinicalNote::where('visit_id', $id)->orderBy('created_at')->first()?->versions->firstWhere('state', 'draft');
            $only = fn ($q) => isset($d['ids']) ? $q->whereIn('id', $d['ids']) : $q;
            $stamp = ['approved_by' => $ctx->userId, 'approved_at' => now()];
            $counts = [
                'note_versions' => $draft ? $only(ClinicalNoteVersion::whereKey($draft->id)->where('state', 'draft')->where('source', 'ai_draft')->whereNull('approved_at'))->update($stamp) : 0,
                'findings' => $only(self::pendingQuery(ToothFinding::query(), $id))->update($stamp),
                'procedures' => $only(self::pendingQuery(ProcedureRecord::query(), $id))->update($stamp),
            ];
            if (array_sum($counts)) {
                Audit::log('setujui_draf_ai', 'visit', $id, $counts);
            }

            return response()->json(['approved' => $counts, 'pending' => self::unapproved($id, $draft?->fresh())]);
        });
    }

    /** @return array{note_version_ids: list<string>, finding_ids: list<string>, procedure_ids: list<string>} */
    private static function unapproved(string $visitId, ?ClinicalNoteVersion $draft): array
    {
        return [
            'note_version_ids' => $draft && $draft->source === 'ai_draft' && $draft->approved_at === null ? [$draft->id] : [],
            'finding_ids' => self::pendingQuery(ToothFinding::query(), $visitId)->orderBy('id')->pluck('id')->all(),
            'procedure_ids' => self::pendingQuery(ProcedureRecord::query(), $visitId)->orderBy('id')->pluck('id')->all(),
        ];
    }

    private static function pendingQuery($q, string $visitId)
    {
        return $q->where('visit_id', $visitId)->where('state', 'draft')->where('source', 'ai_draft')->whereNull('approved_at');
    }

    /** POST /api/notes/{id}/corrections {reason, soap}: v(n+1) supersedes the current version; older versions untouched. */
    public function correct(CorrectionRequestBody $request, string $id, TenancyDirectory $tenancy)
    {
        $d = $request->validated();
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($d, $id, $me, $tenancy) {
            $note = ClinicalNote::lockForUpdate()->findOrFail($id);
            if ($note->author_id !== $me) {
                return Audit::denied('note.author');
            }
            $current = self::current($note);
            if (! $current) {
                return self::conflict('not_signed', 'Catatan belum ditandatangani; ubah drafnya saja.');
            }
            if (CorrectionRequest::where('note_id', $id)->where('state', 'diajukan')->exists()) {
                return self::conflict('correction_pending', 'Masih ada koreksi yang menunggu persetujuan.');
            }
            $soap = Soap::normalize($d['soap']);
            $original = $note->versions->where('state', 'signed')->sortBy('version')->first();
            if (now()->lessThanOrEqualTo($original->signed_at->copy()->addHours(self::FREE_EDIT_HOURS))) {
                $v = $this->appendSigned($note, $current, $soap, $d['reason'], $me, null);

                return response()->json(['approval' => 'not_needed', 'version_id' => $v->id, 'version' => $v->version], 201);
            }
            $solo = $tenancy->activeDentistCount() === 1; // D-013: solo practice self-approves with the recorded reason
            $req = CorrectionRequest::create([
                'note_id' => $id, 'base_version_id' => $current->id, 'proposed_soap_enc' => Crypto::encrypt(Soap::canonicalJson($soap)),
                'reason' => $d['reason'], 'requested_by' => $me, 'state' => $solo ? 'disetujui' : 'diajukan', 'self_approved' => $solo,
                'approved_by' => $solo ? $me : null, 'approved_at' => $solo ? now() : null, 'approval_reason' => $solo ? $d['reason'] : null,
            ]);
            Audit::log('ajukan_koreksi', 'correction_request', $req->id, ['note_id' => $id, 'self_approved' => $solo]);
            if (! $solo) {
                return response()->json(['approval' => 'pending', 'correction_request_id' => $req->id], 202);
            }
            $v = $this->appendSigned($note, $current, $soap, $d['reason'], $me, $req->id);

            return response()->json(['approval' => 'self', 'correction_request_id' => $req->id, 'version_id' => $v->id, 'version' => $v->version], 201);
        });
    }

    /** POST /api/correction-requests/{id}/approve (owner; not the requester). */
    public function approve(string $id)
    {
        $me = Ctx::current()->userId;

        return DB::transaction(function () use ($id, $me) {
            $req = CorrectionRequest::lockForUpdate()->findOrFail($id);
            if ($req->state !== 'diajukan') {
                return self::conflict('not_pending', 'Permintaan koreksi ini sudah diproses.');
            }
            if ($req->requested_by === $me) {
                return Audit::denied('correction.approve_own');
            }
            $note = ClinicalNote::lockForUpdate()->findOrFail($req->note_id);
            $current = self::current($note);
            if ($current?->id !== $req->base_version_id) {
                return self::conflict('stale', 'Versi catatan sudah berubah sejak koreksi diajukan.');
            }
            $req->update(['state' => 'disetujui', 'approved_by' => $me, 'approved_at' => now()]);
            Audit::log('setujui_koreksi', 'correction_request', $req->id, ['note_id' => $note->id]);
            $v = $this->appendSigned($note, $current, $req->proposedSoap(), $req->reason, $req->requested_by, $req->id);

            return response()->json(['version_id' => $v->id, 'version' => $v->version]);
        });
    }

    private function appendSigned(ClinicalNote $note, ClinicalNoteVersion $current, array $soap, string $reason, string $signer, ?string $requestId): ClinicalNoteVersion
    {
        $v = (new ClinicalNoteVersion([
            'note_id' => $note->id, 'version' => $note->versions->max('version') + 1, 'supersedes_id' => $current->id,
            'reason' => $reason, 'correction_request_id' => $requestId, 'state' => 'signed', 'source' => 'manual',
            'signed_by' => $signer, 'signed_at' => now(), 'created_by' => Ctx::current()->userId,
        ]))->setSoap($soap);
        $v->save();
        $this->outbox->enqueue('satusehat', 'satusehat:note_version:'.$v->id, ['note_version_id' => $v->id, 'supersedes_id' => $current->id]);
        Audit::log('koreksi', 'clinical_note_version', $v->id, ['version' => $v->version, 'supersedes_id' => $current->id, 'correction_request_id' => $requestId]);

        return $v;
    }

    /** Current = signed version nobody supersedes. */
    private static function current(ClinicalNote $note): ?ClinicalNoteVersion
    {
        $superseded = $note->versions->pluck('supersedes_id')->filter()->all();

        return $note->versions->where('state', 'signed')->first(fn ($v) => ! in_array($v->id, $superseded, true));
    }

    private static function conflict(string $error, string $message, array $extra = [])
    {
        return response()->json(['error' => $error, 'message' => $message, ...$extra], 409);
    }
}
