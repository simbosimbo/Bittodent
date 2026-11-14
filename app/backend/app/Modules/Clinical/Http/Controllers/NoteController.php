<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Http\Requests\CorrectionRequestBody;
use App\Modules\Clinical\Http\Requests\SaveNoteRequest;
use App\Modules\Clinical\Http\Requests\SignRequest;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\CorrectionRequest;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Integrations\Contracts\OutboxPublisher;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// SOAP draft -> sign (dentist author + fresh TOTP) -> corrections (new version; >2x24h via correction_request, D-013).
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
            $draft->setSoap($d['soap'])->fill(['source' => $d['source'] ?? 'manual', 'revision' => $draft->revision + 1])->save();
            Audit::log($draft->revision === 1 ? 'buat' : 'ubah', 'clinical_note_version', $draft->id, ['revision' => $draft->revision]);

            return response()->json(['note_id' => $note->id, 'version_id' => $draft->id, 'revision' => $draft->revision,
                'source' => $draft->source, 'content_hash' => $draft->content_hash]);
        });
    }

    /** POST /api/visits/{id}/sign {revision, confirm: true, code}: dentist role (route) + author + fresh TOTP. */
    public function sign(SignRequest $request, string $id, UserDirectory $users)
    {
        $ctx = Ctx::current();

        return DB::transaction(function () use ($request, $id, $users, $ctx) {
            $visit = Visit::lockForUpdate()->findOrFail($id);
            $note = ClinicalNote::where('visit_id', $id)->orderBy('created_at')->first();
            $draft = $note?->versions->firstWhere('state', 'draft');
            if (! $draft) {
                return self::conflict($note ? 'signed' : 'no_draft', $note ? 'Catatan sudah ditandatangani.' : 'Belum ada draf catatan.');
            }
            if ($note->author_id !== $ctx->userId || ! $ctx->coversBranch($visit->branch_id)) {
                return Audit::denied('note.author');
            }
            if (! $request->confirmed() || ! $users->verifyTotp($ctx->userId, $request->input('code'))) {
                Audit::log('tanda_tangan_ditolak', 'clinical_note_version', $draft->id, ['why' => 'konfirmasi']);

                return response()->json(['error' => 'confirmation_required', 'message' => 'Konfirmasi dan kode autentikator yang benar wajib.'], 403);
            }
            if ($request->integer('revision') !== $draft->revision) {
                return self::conflict('stale', 'Draf berubah sejak Anda membacanya. Periksa lagi sebelum tanda tangan.', ['revision' => $draft->revision]);
            }
            $now = now();
            $draft->forceFill(['content_hash' => Soap::hash($draft->soap()), 'state' => 'signed', 'signed_by' => $ctx->userId, 'signed_at' => $now])->save();
            $drafts = ToothFinding::where('visit_id', $id)->where('state', 'draft')->get();
            $findings = ToothFinding::where('visit_id', $id)->where('state', 'draft')
                ->update(['state' => 'final', 'finalized_by' => $ctx->userId, 'finalized_at' => $now]);
            $drafts->where('status', 'selesai')->each(fn ($f) => FindingController::recorded($f));
            $this->outbox->enqueue('satusehat', 'satusehat:note_version:'.$draft->id, ['note_version_id' => $draft->id, 'visit_id' => $id]);
            Audit::log('tanda_tangan', 'clinical_note_version', $draft->id, ['visit_id' => $id, 'findings' => $findings]);

            return response()->json(['version_id' => $draft->id, 'signed_at' => $now, 'content_hash' => $draft->content_hash, 'findings_locked' => $findings]);
        });
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
