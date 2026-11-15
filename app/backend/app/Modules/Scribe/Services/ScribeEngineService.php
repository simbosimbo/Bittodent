<?php

namespace App\Modules\Scribe\Services;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftState;
use App\Modules\Agents\Contracts\ReplyCheck;
use App\Modules\Clinical\Contracts\VisitDirectory;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scribe\Contracts\AudioStore;
use App\Modules\Scribe\Contracts\ScribeDenied;
use App\Modules\Scribe\Contracts\ScribeEngine;
use App\Modules\Scribe\Contracts\ScribeGate;
use App\Modules\Scribe\Contracts\ScribeSessionState;
use App\Modules\Scribe\Contracts\SpeechToText;
use App\Modules\Scribe\Contracts\SpeechToTextUnavailable;
use App\Modules\Scribe\Contracts\Transcript;
use App\Modules\Scribe\Models\ScribeSession;
use App\Shared\Ai\CitationValidator;
use App\Shared\Ai\Pseudonymizer;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\File;

final class ScribeEngineService implements ScribeEngine
{
    private const PROMPT = 'scribe-soap-v1';

    private const SYSTEM = 'Kamu merapikan transkrip dikte dokter gigi menjadi draf SOAP. Hanya tuliskan ulang yang diucapkan. Jangan menambah diagnosis, obat, atau kode yang tidak diucapkan. Setiap butir wajib punya section S, O, A, atau P dan refs ke id segmen (T1, T2, ...). Keluaran JSON: {"claims":[{"section":"S","text":"...","refs":["T1"]},...]}';

    public function __construct(
        private VisitDirectory $visits,
        private PatientDirectory $patients,
        private ScribeGate $gate,
        private AudioStore $audio,
        private SpeechToText $stt,
        private AgentRuns $runs,
        private AgentDrafts $drafts,
    ) {}

    public function ingest(string $visitId, string $dentistId, string $plaintextAudio, string $mime, int $durationSec): string
    {
        $visit = $this->visits->findOrFail($visitId);
        if ($visit['dentist_id'] !== $dentistId) {
            throw new ScribeDenied(ScribeDenied::FORBIDDEN, 403);
        }
        if (! $this->gate->paidEnabled()) {
            throw new ScribeDenied(ScribeDenied::PAID_DISABLED, 403);
        }
        if ($this->gate->wouldExceedCap()) {
            throw new ScribeDenied(ScribeDenied::TOKEN_CAP, 429);
        }

        $session = ScribeSession::create([
            'visit_id' => $visitId,
            'dentist_id' => $dentistId,
            'state' => ScribeSessionState::Terunggah->value,
            'mime' => $mime,
            'duration_sec' => $durationSec,
            'stt_driver' => class_basename($this->stt::class),
        ]);
        $session->audio_key = $this->audio->put($session->id, $plaintextAudio, $mime);
        $session->save();
        Audit::log('buat', 'scribe_session', $session->id, ['visit_id' => $visitId]);

        $this->process($session->id);

        return $session->id;
    }

    public function process(string $sessionId): void
    {
        $session = ScribeSession::findOrFail($sessionId);
        if ($session->audio_deleted_at !== null || ! $this->audio->exists($session->id)) {
            $session->update(['state' => ScribeSessionState::Gagal->value, 'error_code' => 'audio_missing']);

            return;
        }
        $session->update(['state' => ScribeSessionState::Memproses->value, 'error_code' => null]);

        $tmp = $this->audio->openPlaintext($session->id);
        try {
            $transcript = $this->stt->transcribe($tmp, (string) $session->mime, (int) $session->duration_sec);
        } catch (SpeechToTextUnavailable $e) {
            $session->update(['state' => ScribeSessionState::Gagal->value, 'error_code' => $e->reason]);
            throw new ScribeDenied(ScribeDenied::STT_UNAVAILABLE, 503);
        } finally {
            File::delete($tmp);
        }

        $session->transcript_enc = Crypto::encrypt(json_encode(
            array_map(fn ($s) => ['id' => $s->id, 'text' => $s->text], $transcript->segments),
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        ));
        $session->save();

        $visit = $this->visits->findOrFail($session->visit_id);
        $kept = $this->draftSoap($session, $visit, $transcript);
        if ($kept === 0) {
            $session->update(['state' => ScribeSessionState::Gagal->value, 'error_code' => 'no_cited_claims']);
            throw new ScribeDenied(ScribeDenied::PROCESSING_FAILED, 422);
        }
        $this->wipeAudio($session, 'processed');
        $session->update(['state' => ScribeSessionState::DrafSiap->value, 'error_code' => null]);
    }

    public function sweepExpiredAudio(\DateTimeInterface $now): int
    {
        $cutoff = \Carbon\CarbonImmutable::instance(\DateTimeImmutable::createFromInterface($now))->subDay();
        $n = 0;
        foreach (ScribeSession::query()->whereNull('audio_deleted_at')->where('created_at', '<=', $cutoff)->get() as $session) {
            if ($this->wipeAudio($session, 'expired')) {
                $n++;
            }
        }

        return $n;
    }

    public function approveItem(string $draftId, ?string $editedText = null): array
    {
        $payload = $this->drafts->approve($draftId);
        $text = is_string($editedText) && $editedText !== '' && $editedText !== ($payload['text'] ?? null)
            ? $editedText
            : (string) ($payload['text'] ?? '');
        if ($text !== ($payload['text'] ?? null)) {
            Audit::log('ubah', 'agent_draft', $draftId, ['edited' => true]);
        }

        return [
            'id' => $draftId,
            'section' => (string) ($payload['section'] ?? ''),
            'text' => $text,
            'refs' => array_values($payload['refs'] ?? []),
        ];
    }

    public function rejectItem(string $draftId, string $reason): void
    {
        $this->drafts->reject($draftId, $reason);
    }

    public function statusForVisit(string $visitId): array
    {
        $this->visits->findOrFail($visitId);
        $session = ScribeSession::query()->where('visit_id', $visitId)->orderByDesc('created_at')->first();
        $items = [];
        foreach ($this->drafts->forTarget(DraftKind::Soap, 'visit', $visitId) as $row) {
            $items[] = [
                'id' => $row['id'],
                'state' => $row['state'] instanceof DraftState ? $row['state']->value : (string) $row['state'],
                'section' => $row['payload']['section'] ?? null,
                'text' => $row['payload']['text'] ?? '',
                'refs' => array_values($row['payload']['refs'] ?? []),
            ];
        }

        return [
            'paid_enabled' => $this->gate->paidEnabled(),
            'disabled' => ! $this->gate->paidEnabled(),
            'token_cap' => $this->gate->monthlyTokenCap(),
            'tokens_used' => $this->gate->tokensUsedThisMonth(),
            'tokens_remaining' => $this->gate->remainingTokens(),
            'session' => $session ? [
                'id' => $session->id,
                'state' => $session->state,
                'audio_deleted' => $session->audio_deleted_at !== null,
                'error_code' => $session->error_code,
            ] : null,
            'items' => $items,
        ];
    }

    /** @param array{id: string, patient_id: string, branch_id: string, dentist_id: string} $visit */
    private function draftSoap(ScribeSession $session, array $visit, Transcript $transcript): int
    {
        $patient = $this->patients->summary($visit['patient_id']);
        $scrub = new Pseudonymizer;
        $terms = array_filter([$patient['name'], $patient['mrn'] ?? null], fn ($t) => is_string($t) && $t !== '');
        $segments = [];
        foreach ($transcript->segments as $s) {
            $segments[] = ['id' => $s->id, 'text' => $scrub->scrub($s->text, array_values($terms))];
        }
        $manifest = $transcript->citationManifest();
        $input = json_encode(['segments' => $segments], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $kept = [];
        $result = $this->runs->call(
            new AgentCall(
                AgentKind::Scribe,
                self::PROMPT,
                new ModelRequest(self::SYSTEM, $input, 1024, 0.0),
                array_map(fn ($s) => ['type' => 'transcript', 'id' => $s->id], $transcript->segments),
                $visit['patient_id'],
                false,
                $scrub->count,
            ),
            function (ModelReply $reply) use ($manifest, &$kept) {
                $data = json_decode($reply->text, true);
                $claims = is_array($data['claims'] ?? null) ? $data['claims'] : (is_array($data) && array_is_list($data) ? $data : []);
                $check = CitationValidator::validate($claims, $manifest, [
                    'S' => ['transcript'], 'O' => ['transcript'], 'A' => ['transcript'], 'P' => ['transcript'],
                ]);
                $kept = $check->kept;
                $ok = $check->kept !== [] && $check->droppedRatio() <= 0.5;

                return new ReplyCheck($ok, count($check->kept) + count($check->dropped), count($check->dropped));
            }
        );
        $session->soap_run_id = $result->runId;
        $session->save();
        if (! $result->ok() || $kept === []) {
            return 0;
        }
        $requestedBy = Ctx::current()->userId ?? '';
        if ($requestedBy !== '') {
            $this->drafts->supersedeOpen(DraftKind::Soap, 'visit', $session->visit_id, $requestedBy, '00000000-0000-0000-0000-000000000000');
        }
        $n = 0;
        foreach ($kept as $claim) {
            $section = $claim['section'] ?? '';
            if (! in_array($section, ['S', 'O', 'A', 'P'], true)) {
                continue;
            }
            $this->drafts->propose($result->runId, DraftKind::Soap, 'visit', $session->visit_id, [
                'section' => $section,
                'text' => $claim['text'],
                'refs' => $claim['refs'],
            ], array_map(fn ($r) => ['ref' => $r], $claim['refs']));
            $n++;
        }

        return $n;
    }

    private function wipeAudio(ScribeSession $session, string $reason): bool
    {
        $removed = $this->audio->wipe($session->id);
        if ($session->audio_deleted_at === null) {
            $session->audio_key = null;
            $session->audio_deleted_at = now();
            if ($session->state !== ScribeSessionState::DrafSiap->value && $session->state !== ScribeSessionState::Gagal->value) {
                $session->state = ScribeSessionState::AudioDihapus->value;
            }
            $session->save();
            Audit::log('hapus', 'scribe_session', $session->id, ['reason' => $reason]);
        }

        return $removed || true;
    }
}
