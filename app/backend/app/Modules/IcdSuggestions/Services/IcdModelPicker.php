<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Agents\Contracts\AgentCall;
use App\Modules\Agents\Contracts\AgentKind;
use App\Modules\Agents\Contracts\AgentRuns;
use App\Modules\Agents\Contracts\ReplyCheck;
use App\Modules\IcdSuggestions\Contracts\IcdDictionary;
use App\Modules\IcdSuggestions\Domain\IcdQuery;
use App\Modules\IcdSuggestions\Domain\IcdSuggestion;
use App\Modules\IcdSuggestions\Domain\QuerySpan;
use App\Modules\IcdSuggestions\Domain\SuggestionSource;
use App\Shared\Ai\CitationValidator;
use App\Shared\Ai\Pseudonymizer;

// Paid, optional: the model may only CHOOSE among IcdSearch candidates and must cite refs from the input (F1.., A, P).
// Input = scrubbed A/P text + findings by ref + candidate list (code, display, version, system). No names, NIK, UUIDs, MRN.
// Anything off (allowlist miss, model down, bad JSON, unknown ref/code, too many drops) => null: caller falls back.
final class IcdModelPicker
{
    public const PROMPT_VERSION = 'icd-koding-v1';

    private const MAX_DROP_RATIO = 0.5;

    private const SYSTEM_PROMPT = 'Anda membantu dokter gigi memilih kode ICD. Pilih HANYA dari daftar candidates (maksimal 3 per system) '
        .'yang didukung oleh items. Jangan membuat kode baru. Balas JSON saja: {"suggestions":[{"system":"icd10|icd9cm","code":"...",'
        .'"text":"alasan singkat","refs":["F1"]}]}. refs wajib berisi ref dari items.';

    public function __construct(private AgentRuns $runs, private IcdDictionary $dictionary) {}

    /**
     * @param  list<array>  $pool  IcdEngine::pool()
     * @param  list<string>  $terms  identifying strings to scrub (VisitCoding::redactionTerms)
     * @return array{run_id: string, suggestions: list<IcdSuggestion>|null}|null null = no call made
     */
    public function pick(IcdQuery $q, array $pool, array $terms, ?string $patientId, IcdEngine $engine): ?array
    {
        // shortcut: the model is chosen by the bound ModelClient (config ai.bedrock.model_id); this only refuses when the A1 model
        // is not on the allowlist. Pass the model id per call when BedrockJakartaModelClient is wired (D-030 gate).
        if ($pool === [] || ! in_array(config('ai.icd.model_id'), (array) config('ai.allowed_model_ids'), true)) {
            return null;
        }
        $scrub = new Pseudonymizer;
        $items = array_map(fn (QuerySpan $s) => ['ref' => $s->ref, 'type' => $s->source['type'],
            'text' => $s->source['type'] === 'finding' ? self::findingText($s) : $scrub->scrub($s->text, $terms, 1000)], $q->spans);
        $candidates = array_map(fn ($p) => ['system' => $p['entry']->system->value, 'code' => $p['entry']->code,
            'display' => $p['entry']->display, 'version' => $p['entry']->version], array_slice($pool, 0, 40));
        $input = json_encode(['items' => $items, 'candidates' => $candidates], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $refs = array_map(fn (QuerySpan $s) => array_intersect_key($s->source, array_flip(['type', 'id', 'version'])), $q->spans);

        $byKey = array_column(array_map(fn ($p) => [$p['entry']->system->value.':'.$p['entry']->code, $p], $pool), 1, 0);
        $picked = [];
        $result = $this->runs->call(AgentCall::prompt(AgentKind::Koding, self::PROMPT_VERSION, self::SYSTEM_PROMPT, $input, 600, 0.0, $refs, $patientId, $scrub->count),
            function ($r) use ($q, $byKey, &$picked) { // $r: Integrations ModelReply (untrusted text)
                $picked = $this->validate($r->text, $q, $byKey, $total, $dropped);

                return new ReplyCheck($picked !== [] && $dropped / max(1, $total) <= self::MAX_DROP_RATIO, $total, $dropped);
            });
        if (! $result->ok()) {
            return ['run_id' => $result->runId, 'suggestions' => null];
        }
        $rank = ['icd10' => 0, 'icd9cm' => 0];

        return ['run_id' => $result->runId, 'suggestions' => array_map(fn ($x) => $engine->suggestion($q, $x[0], $x[1], SuggestionSource::Model,
            ++$rank[$x[0]['entry']->system->value]), $picked)];
    }

    /** @return list<array{0: array, 1: list<string>}> pool item + validated refs */
    private function validate(string $text, IcdQuery $q, array $byKey, ?int &$total, ?int &$dropped): array
    {
        $claims = json_decode($text, true)['suggestions'] ?? null;
        if (! is_array($claims) || ! array_is_list($claims)) {
            [$total, $dropped] = [1, 1];

            return [];
        }
        $total = count($claims);
        $res = CitationValidator::validate(array_map(fn ($c) => is_array($c) ? ['text' => is_string($c['code'] ?? null) ? $c['code'] : '',
            'refs' => $c['refs'] ?? null] : $c, $claims), $q->manifest());
        $droppedIdx = array_column($res->dropped, 'index');
        $picked = [];
        $count = ['icd10' => 0, 'icd9cm' => 0];
        foreach (array_values(array_diff(array_keys($claims), $droppedIdx)) as $i => $idx) {
            $key = (is_string($claims[$idx]['system'] ?? null) ? $claims[$idx]['system'] : '').':'.$res->kept[$i]['text'];
            $p = $byKey[$key] ?? null;
            if ($p === null || isset($picked[$key]) || ! $this->dictionary->exists($p['entry']->system, $p['entry']->code)
                || ++$count[$p['entry']->system->value] > IcdEngine::PER_SYSTEM) {
                $droppedIdx[] = $idx; // not a candidate, duplicate, gone from the dictionary or over the limit: dropped, never repaired

                continue;
            }
            $picked[$key] = [$p, $res->kept[$i]['refs']];
        }
        $dropped = count($droppedIdx);

        return array_values($picked);
    }

    private static function findingText(QuerySpan $s): string
    {
        return 'gigi '.$s->source['tooth'].($s->source['surface'] ? ' permukaan '.$s->source['surface'] : '').': '.$s->text;
    }
}
