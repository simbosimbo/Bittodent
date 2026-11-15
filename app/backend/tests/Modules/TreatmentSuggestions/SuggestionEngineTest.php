<?php

namespace Tests\Modules\TreatmentSuggestions;

use App\Modules\TreatmentSuggestions\Domain\Candidate;
use App\Modules\TreatmentSuggestions\Domain\Rule;
use App\Modules\TreatmentSuggestions\Services\SuggestionEngine;
use PHPUnit\Framework\TestCase;

// Pure rules engine: findings in, cited suggestions out. No DB.
class SuggestionEngineTest extends TestCase
{
    private function rules(): array
    {
        return [
            new Rule('r1', 'karies-tumpatan', 1, 'karies', null, '23.2', 20),
            new Rule('r2', 'sisa-akar-cabut', 1, 'sisa_akar', null, '23.09', 10),
            new Rule('r3', 'perlu-dicabut-cabut', 1, 'perlu_dicabut', null, '23.09', 10),
        ];
    }

    private static function f(string $id, int $tooth, ?string $surface, string $condition, string $status = 'kondisi_pantau', int $version = 1): array
    {
        return ['id' => $id, 'version' => $version, 'tooth' => $tooth, 'surface' => $surface, 'condition' => $condition, 'status' => $status];
    }

    private function run_(array $findings, array $planned = [], array $approvals = [], ?array $rules = null): array
    {
        return (new SuggestionEngine)->suggest($rules ?? $this->rules(), $findings, $planned, $approvals);
    }

    public function test_no_findings_means_no_suggestions(): void
    {
        $this->assertSame([], $this->run_([]));
        $this->assertSame([], $this->run_([self::f('a', 11, 'I', 'tambalan'), self::f('b', 21, null, 'mahkota')])); // no rule for them
    }

    public function test_rule_maps_finding_to_procedure_and_cites_every_source_finding(): void
    {
        $out = $this->run_([self::f('m', 26, 'M', 'karies'), self::f('o', 26, 'O', 'karies', version: 3), self::f('x', 18, null, 'sisa_akar')]);

        $this->assertCount(2, $out);
        [$first, $second] = $out;
        $this->assertSame([18, '23.09', [], 'sisa_akar'], [$first->tooth, $first->rule->procedureCode, $first->surfaces, $first->condition]); // priority 10 first
        $this->assertSame([26, '23.2', ['M', 'O']], [$second->tooth, $second->rule->procedureCode, $second->surfaces]);
        $this->assertSame([['m', 1], ['o', 3]], array_map(fn ($c) => [$c['id'], $c['version']], $second->citations));
        $this->assertSame('karies', $second->condition); // copied from the findings, never inferred
    }

    public function test_nothing_outside_the_recorded_findings(): void
    {
        $findings = [self::f('a', 36, 'O', 'karies'), self::f('b', 47, 'O', 'tambalan')];
        $cited = [];
        foreach ($this->run_($findings) as $c) {
            foreach ($c->citations as $x) {
                $cited[] = $x['id'];
            }
            $this->assertContains($c->tooth, [36, 47]);
        }
        $this->assertSame(['a'], $cited);
    }

    public function test_only_findings_still_under_observation_raise_a_suggestion(): void
    {
        foreach (['direncanakan', 'selesai', 'dirujuk', 'ada_di_klinik_ini', 'ada_di_tempat_lain'] as $status) {
            $this->assertSame([], $this->run_([self::f('a', 36, 'O', 'karies', $status)]), $status);
        }
    }

    public function test_duplicates_with_planned_or_done_work_and_open_drafts_are_dropped(): void
    {
        $findings = [self::f('a', 36, 'O', 'karies'), self::f('b', 26, 'O', 'karies'), self::f('c', 26, 'M', 'karies'), self::f('d', 18, null, 'perlu_dicabut')];
        $planned = [
            ['tooth' => 36, 'surface' => 'D', 'status' => 'direncanakan', 'procedure_code' => '23.2', 'state' => 'final'], // same code on the tooth
            ['tooth' => 26, 'surface' => 'O', 'status' => 'kondisi_pantau', 'procedure_code' => null, 'state' => 'draft'], // dentist is drafting 26-O
            ['tooth' => 18, 'surface' => null, 'status' => 'selesai', 'procedure_code' => '23.09', 'state' => 'draft'],
        ];
        $out = $this->run_($findings, $planned);

        $this->assertCount(1, $out);
        $this->assertSame([26, ['M'], ['c']], [$out[0]->tooth, $out[0]->surfaces, array_column($out[0]->citations, 'id')]);
    }

    public function test_one_procedure_per_tooth_and_highest_priority_rule_wins(): void
    {
        $rules = [...$this->rules(), new Rule('r4', 'karies-lain', 1, 'karies', ['O'], '23.2', 5)];
        $out = $this->run_([self::f('a', 36, 'O', 'karies'), self::f('b', 36, 'M', 'karies')], rules: $rules);

        $this->assertCount(1, $out);
        $this->assertSame('karies-lain', $out[0]->rule->key);   // priority 5 took 36-O ...
        $this->assertSame(['M', 'O'], $out[0]->surfaces);         // ... and 36-M joins the same procedure on that tooth
    }

    public function test_surface_limited_rule_ignores_other_surfaces(): void
    {
        $out = $this->run_([self::f('a', 36, 'B', 'karies')], rules: [new Rule('r', 'oklusal', 1, 'karies', ['O'], '23.2', 1)]);
        $this->assertSame([], $out);
    }

    public function test_order_is_priority_then_dentist_choice_signal_then_tooth(): void
    {
        $rules = [new Rule('r1', 'a-rule', 1, 'karies', null, '23.2', 20), new Rule('r2', 'b-rule', 1, 'sisa_akar', null, '23.09', 20)];
        $findings = [self::f('a', 11, 'I', 'karies'), self::f('b', 46, null, 'sisa_akar')];

        $this->assertSame([11, 46], array_map(fn (Candidate $c) => $c->tooth, $this->run_($findings, rules: $rules)));
        $signal = $this->run_($findings, approvals: ['b-rule' => 4], rules: $rules);
        $this->assertSame([46, 11], array_map(fn (Candidate $c) => $c->tooth, $signal));
        $this->assertSame(4, $signal[0]->approvals);
        // deterministic
        $this->assertEquals($signal, $this->run_(array_reverse($findings), approvals: ['b-rule' => 4], rules: array_reverse($rules)));
    }
}
