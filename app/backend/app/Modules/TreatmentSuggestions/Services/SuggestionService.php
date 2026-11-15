<?php

namespace App\Modules\TreatmentSuggestions\Services;

use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Modules\Agents\Contracts\DraftState;
use App\Modules\Clinical\Contracts\PlannedTreatment;
use App\Modules\Clinical\Contracts\PlanRefused;
use App\Modules\Clinical\Contracts\TreatmentPlan;
use App\Modules\Tariffs\Contracts\ProcedureCatalog;
use App\Modules\TreatmentSuggestions\Domain\Candidate;
use App\Modules\TreatmentSuggestions\Domain\SuggestionRefused;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

// A2 orchestration. Suggestions live as agent_draft (kind saran_tindakan, one item per draft, target = visit) created by a
// deterministic agent_run. Approving = AgentDrafts::approve + TreatmentPlan::addPlannedDraft in ONE transaction (a draft plan
// item, never a signature or a note). Rejecting = AgentDrafts::reject with a short reason code (feedback).
final class SuggestionService
{
    public const PROMPT_VERSION = 'saran-aturan-v1';

    public const REJECT_REASONS = ['tidak_perlu' => 'Tidak perlu', 'sudah_direncanakan' => 'Sudah direncanakan', 'pasien_menolak' => 'Pasien menolak',
        'tindakan_lain' => 'Tindakan lain', 'lainnya' => 'Lainnya'];

    public function __construct(private TreatmentPlan $plan, private RuleBook $rules, private SuggestionEngine $engine,
        private ProcedureCatalog $catalog, private AgentRuns $runs, private AgentDrafts $drafts) {}

    /** GET for a patient: their open visit's suggestions; with no open visit a read-only preview (nothing stored). */
    public function forPatient(string $patientId): array
    {
        if ($visitId = $this->plan->openVisitOf($patientId)) {
            return $this->forVisit($visitId);
        }
        $items = array_map(fn (array $p) => self::item(null, 'draf', $p, false), $this->candidates($patientId));

        return ['visit_id' => null, 'patient_id' => $patientId, 'locked' => true, 'items' => $items, 'counts' => self::counts($items)];
    }

    /** GET for a visit. On an open visit, new rule matches are stored as drafts (one deterministic run), then everything is listed. */
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
        $item = DB::transaction(function () use ($draftId) {
            try {
                $payload = $this->drafts->approve($draftId, DraftKind::SaranTindakan);
            } catch (DraftReviewDenied $e) {
                throw new SuggestionRefused($e->reason === DraftReviewDenied::FORBIDDEN ? 'forbidden' : 'wrong_state');
            }
            $visit = $this->visit($payload['visit_id']);
            if (! $visit['open']) {
                throw new SuggestionRefused('visit_closed');
            }
            $still = collect($this->candidates($visit['patient_id'], $visit['id']))->firstWhere('key', $payload['key']);
            if (! self::same($still, $payload)) {
                throw new SuggestionRefused('stale');
            }
            try {
                $ids = $this->plan->addPlannedDraft($visit['id'], new PlannedTreatment($payload['tooth'], $payload['surfaces'], $payload['condition'], $payload['procedure_code']));
            } catch (PlanRefused $e) {
                throw new SuggestionRefused($e->reason);
            }

            return self::item($draftId, 'disetujui', $payload, false) + ['plan_item_ids' => $ids];
        });

        return $item;
    }

    /** Approves every open suggestion of the visit, best first; ones that went stale stay open and are counted. Safe to repeat. */
    public function approveAll(string $visitId): array
    {
        $visit = $this->visit($visitId);
        if (! $visit['open']) {
            throw new SuggestionRefused('visit_closed');
        }
        if (! Ctx::current()->can('ai_draft.review')) {
            throw new SuggestionRefused('forbidden');
        }
        $approved = $skipped = [];
        foreach ($this->view($visit)['items'] as $item) {
            if ($item['state'] !== 'draf') {
                continue;
            }
            try {
                $approved[] = $this->approve($item['id'])['id'];
            } catch (SuggestionRefused $e) {
                $skipped[] = ['id' => $item['id'], 'reason' => $e->reason];
            }
        }

        return ['approved' => $approved, 'skipped' => $skipped] + $this->view($visit);
    }

    public function reject(string $draftId, string $reason): void
    {
        try {
            $this->drafts->reject($draftId, $reason, DraftKind::SaranTindakan);
        } catch (DraftReviewDenied $e) {
            throw new SuggestionRefused($e->reason === DraftReviewDenied::FORBIDDEN ? 'forbidden' : 'wrong_state');
        }
    }

    // ---------------------------------------------------------------------------------------------------------------

    private function visit(string $visitId): array
    {
        $v = $this->plan->visit($visitId) ?? throw new SuggestionRefused('not_found');
        if (! Ctx::current()->coversBranch($v['branch_id'])) {
            throw new SuggestionRefused('branch');
        }

        return $v;
    }

    /** Engine output as payloads (codes missing from the tariff list are dropped: no invented codes). */
    private function candidates(string $patientId, string $visitId = ''): array
    {
        $rules = $this->rules->effective();
        $approvals = [];
        foreach ($this->drafts->reviewedBy(DraftKind::SaranTindakan, (string) Ctx::current()->userId) as $r) {
            if ($r['state'] === DraftState::Disetujui && isset($r['payload']['rule']['key'])) {
                $approvals[$r['payload']['rule']['key']] = ($approvals[$r['payload']['rule']['key']] ?? 0) + 1;
            }
        }
        $found = $this->engine->suggest($rules, $this->plan->currentFindings($patientId), $this->plan->plannedItems($patientId), $approvals);
        $names = $this->catalog->names(array_map(fn (Candidate $c) => $c->rule->procedureCode, $found));

        return array_values(array_map(fn (Candidate $c) => $c->payload($visitId, $patientId, $names[$c->rule->procedureCode]),
            array_filter($found, fn (Candidate $c) => isset($names[$c->rule->procedureCode]))));
    }

    private function generate(array $visit): void
    {
        // Two taps / two devices at once must not store the same suggestion twice.
        Cache::lock('saran:'.sha1(Ctx::current()->tenant().$visit['id']), 10)->block(5, function () use ($visit) {
            $live = array_column($this->candidates($visit['patient_id'], $visit['id']), null, 'key');
            $seen = [];
            foreach ($this->drafts->forTarget(DraftKind::SaranTindakan, 'visit', $visit['id']) as $d) {
                $key = $d['payload']['key'] ?? '';
                if ($d['state'] === DraftState::MenungguReview && ! self::same($live[$key] ?? null, $d['payload'])) {
                    $this->drafts->supersede($d['id']); // source finding/rule changed: replaced by a fresh draft (or dropped)
                } elseif ($d['state'] !== DraftState::Digantikan) {
                    $seen[$key] = true; // reviewed (or still valid) => never suggested twice in this visit
                }
            }
            $new = array_values(array_filter($live, fn ($p) => ! isset($seen[$p['key']])));
            if ($new === []) {
                return;
            }
            DB::transaction(function () use ($new, $visit) {
                $refs = [];
                foreach ($new as $p) {
                    foreach ($p['citations'] as $c) {
                        $refs[$c['id']] = ['type' => 'finding', 'id' => $c['id'], 'version' => $c['version']];
                    }
                    $refs['rule:'.$p['rule']['id']] = ['type' => 'treatment_rule', 'id' => $p['rule']['id'], 'version' => $p['rule']['version']];
                }
                $hash = hash('sha256', json_encode(array_map(fn ($p) => [$p['key'], $p['rule']['version'], $p['citations']], $new), JSON_THROW_ON_ERROR));
                $runId = $this->runs->recordDeterministic(AgentKind::SaranTindakan, self::PROMPT_VERSION, array_values($refs), $hash, $visit['patient_id']);
                foreach ($new as $p) {
                    $this->drafts->propose($runId, DraftKind::SaranTindakan, 'visit', $visit['id'], $p);
                }
            });
        });
    }

    private function view(array $visit): array
    {
        $live = $visit['open'] ? array_column($this->candidates($visit['patient_id'], $visit['id']), null, 'key') : [];
        $items = [];
        foreach ($this->drafts->forTarget(DraftKind::SaranTindakan, 'visit', $visit['id']) as $d) {
            $state = match ($d['state']) {
                DraftState::MenungguReview => 'draf', DraftState::Disetujui => 'disetujui', DraftState::Ditolak => 'ditolak', default => null,
            };
            if ($state !== null && $d['payload'] !== []) {
                $items[] = self::item($d['id'], $state, $d['payload'], $state === 'draf' && ! self::same($live[$d['payload']['key']] ?? null, $d['payload'])) + ['reviewed_at' => $d['reviewed_at']?->toIso8601String()];
            }
        }
        usort($items, fn ($a, $b) => [$a['state'] !== 'draf', $a['rule']['priority'], -$a['signal']['approvals'], $a['tooth']]
            <=> [$b['state'] !== 'draf', $b['rule']['priority'], -$b['signal']['approvals'], $b['tooth']]);

        return ['visit_id' => $visit['id'], 'patient_id' => $visit['patient_id'], 'locked' => ! $visit['open'], 'items' => $items, 'counts' => self::counts($items)];
    }

    /** Same suggestion = same procedure, rule version and cited finding versions. */
    private static function same(?array $live, array $stored): bool
    {
        $cites = fn (array $p) => array_map(fn ($c) => $c['id'].'@'.$c['version'], $p['citations'] ?? []);

        return $live !== null && $live['procedure_code'] === ($stored['procedure_code'] ?? null)
            && $live['rule']['version'] === ($stored['rule']['version'] ?? null) && $cites($live) === $cites($stored);
    }

    private static function item(?string $id, string $state, array $p, bool $stale): array
    {
        return ['id' => $id, 'state' => $state, 'stale' => $stale, 'tooth' => $p['tooth'], 'surfaces' => $p['surfaces'], 'condition' => $p['condition'],
            'procedure_code' => $p['procedure_code'], 'procedure_name' => $p['procedure_name'], 'citations' => $p['citations'],
            'rule' => $p['rule'], 'signal' => $p['signal']];
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
