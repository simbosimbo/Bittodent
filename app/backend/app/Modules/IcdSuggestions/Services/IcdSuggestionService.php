<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Modules\Agents\Contracts\DraftState;
use App\Modules\Clinical\Contracts\CodingRefused;
use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\Clinical\Contracts\VisitCoding;
use App\Modules\IcdSuggestions\Contracts\IcdDictionary;
use App\Modules\IcdSuggestions\Domain\IcdQuery;
use App\Modules\IcdSuggestions\Domain\IcdRefused;
use App\Modules\IcdSuggestions\Domain\IcdSuggestion;
use App\Modules\IcdSuggestions\Domain\QuerySpan;
use App\Shared\Ai\ClinicAiSettings;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

// A1 orchestration. Suggestions live as agent_draft (kind saran_icd, one code per draft, target = visit). Free mode (default):
// deterministic run only. Paid switch on: model re-pick among the candidates, deterministic fallback on any failure.
// Approve = AgentDrafts::approve + VisitCoding::addDraftCode in ONE transaction (draft SOAP code, never a signature).
final class IcdSuggestionService
{
    public const PROMPT_VERSION = 'icd-kamus-v1';

    public const REJECT_REASONS = ['tidak_sesuai' => 'Tidak sesuai', 'sudah_dicatat' => 'Sudah dicatat', 'terlalu_umum' => 'Terlalu umum',
        'kode_lain' => 'Kode lain', 'lainnya' => 'Lainnya'];

    public function __construct(private VisitCoding $coding, private IcdEngine $engine, private IcdModelPicker $picker,
        private IcdDictionary $dictionary, private ClinicAiSettings $settings, private AgentRuns $runs, private AgentDrafts $drafts) {}

    /** GET for a patient: the open visit's suggestions; with no open visit a read-only preview from signed findings (nothing stored). */
    public function forPatient(string $patientId): array
    {
        if ($visitId = $this->coding->openVisitOf($patientId)) {
            return $this->forVisit($visitId);
        }
        $q = $this->engine->query($this->coding->signedFindings($patientId), null);
        $items = array_map(fn (IcdSuggestion $s) => self::item(null, 'draf', $s->payload('')), $this->engine->deterministic($q, $this->engine->pool($q)));

        return ['visit_id' => null, 'patient_id' => $patientId, 'locked' => true, 'paid' => false, 'items' => $items, 'counts' => self::counts($items)];
    }

    /** GET for a visit. On an open visit, new inputs produce one run + drafts (same inputs: nothing new), then everything is listed. */
    public function forVisit(string $visitId): array
    {
        $visit = $this->visit($visitId);
        if ($visit['open']) {
            $this->generate($visit);
        }

        return $this->view($visit);
    }

    public function approve(string $draftId): array
    {
        return DB::transaction(function () use ($draftId) {
            try {
                $payload = $this->drafts->approve($draftId, DraftKind::SaranIcd);
            } catch (DraftReviewDenied $e) {
                throw new IcdRefused($e->reason === DraftReviewDenied::FORBIDDEN ? 'forbidden' : 'wrong_state');
            }
            $visit = $this->visit($payload['visit_id']);
            $system = IcdSystem::from($payload['system']);
            if (! $this->dictionary->exists($system, $payload['code'])) {
                throw new IcdRefused('stale');
            }
            try {
                $note = $this->coding->addDraftCode($visit['id'], $system, $payload['code']);
            } catch (CodingRefused $e) {
                throw new IcdRefused($e->reason);
            }

            return self::item($draftId, 'disetujui', $payload) + ['note' => $note];
        });
    }

    /** Approves every open suggestion of the visit, best first; refused ones stay open and are listed. Safe to repeat. */
    public function approveAll(string $visitId): array
    {
        $visit = $this->visit($visitId);
        if (! $visit['open']) {
            throw new IcdRefused('visit_closed');
        }
        $approved = $skipped = [];
        foreach ($this->view($visit)['items'] as $item) {
            if ($item['state'] !== 'draf') {
                continue;
            }
            try {
                $approved[] = $this->approve($item['id'])['id'];
            } catch (IcdRefused $e) {
                $skipped[] = ['id' => $item['id'], 'reason' => $e->reason];
            }
        }

        return ['approved' => $approved, 'skipped' => $skipped] + $this->view($visit);
    }

    public function reject(string $draftId, string $reason): void
    {
        try {
            $this->drafts->reject($draftId, $reason, DraftKind::SaranIcd);
        } catch (DraftReviewDenied $e) {
            throw new IcdRefused($e->reason === DraftReviewDenied::FORBIDDEN ? 'forbidden' : 'wrong_state');
        }
    }

    // ---------------------------------------------------------------------------------------------------------------

    private function visit(string $visitId): array
    {
        $v = $this->coding->visit($visitId) ?? throw new IcdRefused('not_found');
        if (! Ctx::current()->coversBranch($v['branch_id'])) {
            throw new IcdRefused('branch');
        }

        return $v;
    }

    private function generate(array $visit): void
    {
        // Two taps / two devices at once must not store the same suggestions twice.
        Cache::lock('saran-icd:'.sha1(Ctx::current()->tenant().$visit['id']), 15)->block(10, function () use ($visit) {
            $q = $this->engine->query($this->coding->signedFindings($visit['patient_id']), $this->coding->openDraftNote($visit['id']));
            $hash = $q->hash();
            $reviewed = [];
            $existing = $this->drafts->forTarget(DraftKind::SaranIcd, 'visit', $visit['id']);
            foreach ($existing as $d) {
                if (($d['payload']['input_hash'] ?? null) === $hash && $d['state'] !== DraftState::Digantikan) {
                    return; // same inputs as the last run: nothing new
                }
                if (in_array($d['state'], [DraftState::Disetujui, DraftState::Ditolak], true)) {
                    $reviewed[$d['payload']['key'] ?? ''] = true; // reviewed once => never suggested again in this visit
                }
            }
            $pool = $this->engine->pool($q);
            $pool = array_values(array_filter($pool, fn ($p) => ! isset($reviewed[$p['entry']->system->value.':'.$p['entry']->code])));
            DB::transaction(function () use ($visit, $q, $hash, $pool, $existing) {
                foreach ($existing as $d) {
                    if ($d['state'] === DraftState::MenungguReview) {
                        $this->drafts->supersede($d['id']); // inputs changed (finding signed, A/P text edited)
                    }
                }
                [$runId, $suggestions] = $this->suggest($visit, $q, $hash, $pool);
                foreach ($suggestions as $s) {
                    $this->drafts->propose($runId, DraftKind::SaranIcd, 'visit', $visit['id'], $s->payload($visit['id']) + ['input_hash' => $hash]);
                }
            });
        });
    }

    /** @return array{0: ?string, 1: list<IcdSuggestion>} run id + suggestions (model pick when allowed and valid, else deterministic) */
    private function suggest(array $visit, IcdQuery $q, string $hash, array $pool): array
    {
        if ($this->settings->paidAiEnabled()) {
            $picked = $this->picker->pick($q, $pool, $this->coding->redactionTerms($visit['id']), $visit['patient_id'], $this->engine);
            if ($picked !== null && $picked['suggestions'] !== null) {
                return [$picked['run_id'], $picked['suggestions']];
            }
        }
        $suggestions = $this->engine->deterministic($q, $pool);
        if ($suggestions === []) {
            return [null, []]; // nothing to label: no run
        }
        $refs = array_map(fn (QuerySpan $s) => array_intersect_key($s->source, array_flip(['type', 'id', 'version'])), $q->spans);

        return [$this->runs->recordDeterministic(AgentKind::Koding, self::PROMPT_VERSION, $refs, $hash, $visit['patient_id']), $suggestions];
    }

    private function view(array $visit): array
    {
        $items = [];
        foreach ($this->drafts->forTarget(DraftKind::SaranIcd, 'visit', $visit['id']) as $d) {
            $state = match ($d['state']) {
                DraftState::MenungguReview => 'draf', DraftState::Disetujui => 'disetujui', DraftState::Ditolak => 'ditolak', default => null,
            };
            if ($state !== null && $d['payload'] !== []) {
                $items[] = self::item($d['id'], $state, $d['payload']) + ['reviewed_at' => $d['reviewed_at']?->toIso8601String()];
            }
        }
        usort($items, fn ($a, $b) => [$a['state'] !== 'draf', $a['system'], $a['rank'], $a['code']] <=> [$b['state'] !== 'draf', $b['system'], $b['rank'], $b['code']]);

        return ['visit_id' => $visit['id'], 'patient_id' => $visit['patient_id'], 'locked' => ! $visit['open'],
            'paid' => $this->settings->paidAiEnabled(), 'items' => $items, 'counts' => self::counts($items)];
    }

    private static function item(?string $id, string $state, array $p): array
    {
        return ['id' => $id, 'state' => $state] + array_intersect_key($p, array_flip(['system', 'code', 'display', 'version', 'reason', 'citations',
            'source', 'rank', 'why', 'perlu_dicek']));
    }

    private static function counts(array $items): array
    {
        $c = ['draf' => 0, 'disetujui' => 0, 'ditolak' => 0];
        foreach ($items as $i) {
            $c[$i['state']]++;
        }

        return $c;
    }
}
