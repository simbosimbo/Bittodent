<?php

namespace App\Modules\ClinicalSummary\Services;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\DraftKind;
use App\Modules\Agents\Contracts\ReplyCheck;
use App\Modules\ClinicalSummary\Domain\Generator;
use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Domain\Prompt;
use App\Modules\ClinicalSummary\Domain\SectionKind;
use App\Modules\ClinicalSummary\Domain\SummarySection;
use App\Modules\ClinicalSummary\Domain\SummarySources;
use App\Modules\ClinicalSummary\Domain\SummaryStatus;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Integrations\Contracts\ModelClient;
use App\Modules\Integrations\Contracts\ModelReply;
use App\Modules\Integrations\Contracts\ModelRequest;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;

// Design 3.1. Writes ONLY agent_run / agent_draft (kind ringkasan, never approvable) / audit_event. Never a clinical table.
// LLM part (keluhan/diagnosis/tindakan) only via AgentRuns (agent_run + audit per call); falls back to the deterministic
// narrative when the model fails or more than 30% of its claims are dropped. Allergies/medication + odontogram are always deterministic.
final class SummaryService
{
    public const MAX_DROPPED_RATIO = 0.3;

    public const TTL_DAYS = 7;

    public const TARGET = 'patient';

    public function __construct(
        private SourceCollector $collector,
        private DeterministicSummarizer $det,
        private Pseudonymizer $pseudonymizer,
        private ClaimChecker $checker,
        private AgentRuns $runs,
        private AgentDrafts $drafts,
        private ModelClient $model,
        private PatientDirectory $patients,
        private UserDirectory $users,
    ) {}

    /** @return array{status_code: int, body: array} */
    public function generate(string $patientId, HistoryScope $scope, bool $allowLlm): array
    {
        $ctx = Ctx::current();
        $src = $this->collector->collect($patientId, $scope); // 404 for another tenant's patient
        $cross = collect($src->history['visits'])->contains(fn ($v) => $v['branch_id'] !== $ctx->branchId); // D-027
        $manifest = $src->manifestHash();
        Audit::log('baca', 'chart', $patientId, ['via' => 'ai_ringkasan', 'sources' => count($src->refs()), 'cross_branch' => $cross]);

        if ($src->isEmpty()) {
            Audit::log('ai_ringkasan_buat', 'patient', $patientId, ['status' => SummaryStatus::Kosong->value]);

            return ['status_code' => 200, 'body' => ['label' => Prompt::LABEL_DETERMINISTIC, 'status' => SummaryStatus::Kosong->value, 'sections' => []]];
        }

        // Double request (same doctor, same patient, same sources, within 60 s) => same result, no new model call.
        $open = $this->drafts->latestOpen(DraftKind::Ringkasan, self::TARGET, $patientId, $ctx->userId);
        if ($open && ($open['payload']['input_hash'] ?? null) === $manifest && $open['created_at']->getTimestamp() >= now()->subSeconds(60)->getTimestamp()) {
            return ['status_code' => 200, 'body' => $this->present($open, false)];
        }

        $structured = $this->det->structured($src);
        [$narrative, $runId, $generator, $degraded, $total, $dropped] = $allowLlm && config('ai.summary_enabled', true)
            ? $this->viaModel($src, $scope, $patientId, $cross)
            : [$this->det->narrative($src), $this->runs->recordDeterministic(AgentKind::Ringkasan, Prompt::DETERMINISTIC_VERSION, $src->refs(), $manifest, $patientId, $cross),
                Generator::Deterministik, false, 0, 0];

        $status = match (true) {
            $generator === Generator::Deterministik => SummaryStatus::Deterministik,
            $dropped > 0 => SummaryStatus::Sebagian,
            default => SummaryStatus::Siap,
        };
        $payload = $this->payload([...$narrative, ...$structured], $src, $scope, $status, $generator, $degraded, $total, $dropped, $manifest);
        $expires = now()->addDays(self::TTL_DAYS);
        $id = $this->drafts->propose($runId, DraftKind::Ringkasan, self::TARGET, $patientId, $payload, [], $expires);
        $this->drafts->supersedeOpen(DraftKind::Ringkasan, self::TARGET, $patientId, $ctx->userId, $id);
        Audit::log('ai_ringkasan_buat', 'patient', $patientId, ['run_id' => $runId, 'summary_id' => $id, 'generator' => $generator->value,
            'status' => $status->value, 'degraded' => $degraded, 'cross_branch' => $cross, 'claims_total' => $total, 'claims_dropped' => $dropped]);

        return ['status_code' => 201, 'body' => $this->present(['id' => $id, 'run_id' => $runId, 'payload' => $payload, 'expires_at' => $expires], false)];
    }

    /** Latest open summary of the current doctor for this patient, with `stale` when the signed sources changed since. */
    public function latest(string $patientId): ?array
    {
        $this->patients->assertExists($patientId);
        $open = $this->drafts->latestOpen(DraftKind::Ringkasan, self::TARGET, $patientId, Ctx::current()->userId);
        if ($open === null) {
            return null;
        }
        $stale = $this->collector->collect($patientId, new HistoryScope(...$open['payload']['scope']))->manifestHash() !== $open['payload']['input_hash'];
        Audit::log('ai_ringkasan_baca', 'patient', $patientId, ['summary_id' => $open['id'], 'stale' => $stale]);

        return $this->present($open, $stale);
    }

    /** @return array{0: list<SummarySection>, 1: string, 2: Generator, 3: bool, 4: int, 5: int} */
    private function viaModel(SummarySources $src, HistoryScope $scope, string $patientId, bool $cross): array
    {
        $staff = array_column($this->users->namesByIds(array_values(array_unique(array_filter([
            ...array_column($src->history['visits'], 'dentist_id'), ...array_column($src->history['notes'], 'signed_by')])))), 'name');
        $terms = [...$this->patients->redactionTerms($patientId), ...$staff, ...array_map(fn ($n) => preg_replace('/^drg\.?\s*/i', '', $n), $staff)];
        $input = $this->pseudonymizer->build($src, $scope, $terms, $this->patients->summary($patientId), $this->det);

        $checked = null;
        $result = $this->runs->call(
            new AgentCall(AgentKind::Ringkasan, Prompt::VERSION, new ModelRequest(Prompt::SYSTEM, $input->json, 1500, 0.0), $src->refs(), $patientId, $cross, $input->redactions),
            function (ModelReply $reply) use ($input, &$checked) {
                $checked = $this->checker->check($reply->text, $input);
                $kept = $checked['total'] - $checked['dropped'];
                $ok = $kept > 0 && $checked['dropped'] / max(1, $checked['total']) <= self::MAX_DROPPED_RATIO;

                return new ReplyCheck($ok, $checked['total'], $checked['dropped']);
            });

        if (! $result->ok()) { // model failed, or too many claims dropped => deterministic narrative, flagged degraded
            return [$this->det->narrative($src), $result->runId, Generator::Deterministik, true, $checked['total'] ?? 0, $checked['dropped'] ?? 0];
        }
        $sections = array_map(fn ($k) => new SummarySection(SectionKind::from($k), Generator::Llm, $checked['sections'][$k]), ClaimChecker::SECTIONS);

        return [$sections, $result->runId, Generator::Llm, false, $checked['total'], $checked['dropped']];
    }

    /** @param list<SummarySection> $sections */
    private function payload(array $sections, SummarySources $src, HistoryScope $scope, SummaryStatus $status, Generator $generator, bool $degraded, int $total, int $dropped, string $manifest): array
    {
        $i = 0;
        $d = $this->model->descriptor();
        $days = array_map(fn ($v) => $src->daysAgo($v['started_at']), $src->history['visits']);

        return [
            'label' => $generator === Generator::Llm ? Prompt::LABEL_AI : Prompt::LABEL_DETERMINISTIC,
            'status' => $status->value,
            'generator' => $generator->value,
            'degraded' => $degraded,
            'model' => $generator === Generator::Llm ? ['provider' => $d->provider, 'model_id' => $d->modelId, 'region' => $d->region, 'prompt_version' => Prompt::VERSION] : null,
            'coverage' => ['visits' => count($src->history['visits']), 'from_days_ago' => $days === [] ? 0 : max($days), 'truncated' => $src->history['truncated']],
            'scope' => ['months' => $scope->months, 'maxVisits' => $scope->maxVisits, 'maxCharsPerNote' => $scope->maxCharsPerNote], // for the stale check
            'claims_total' => $total,
            'claims_dropped' => $dropped,
            'input_hash' => $manifest,
            'sections' => array_map(fn (SummarySection $s) => ['kind' => $s->kind->value, 'generator' => $s->generator->value,
                'claims' => array_map(function ($c) use (&$i) {
                    $i++;

                    return $c->toArray("c$i");
                }, $s->claims)], $sections),
        ];
    }

    private function present(array $draft, bool $stale): array
    {
        $p = $draft['payload'];
        unset($p['scope']);

        return ['summary_id' => $draft['id'], 'run_id' => $draft['run_id'], ...$p, 'stale' => $stale,
            'expires_at' => $draft['expires_at']?->format(DATE_ATOM)];
    }
}
