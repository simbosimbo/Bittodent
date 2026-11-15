<?php

namespace Tests\Modules\IcdSuggestions;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdCandidate;
use App\Modules\IcdSuggestions\Contracts\IcdSearch;
use Tests\TestCase;

// Golden-set eval (tests/ai/golden/icd/cases.json) of the deterministic IcdSearch on the sample dictionary. One check per
// case + system: hit when an expected code is top-1 / in the top 3 (no expected code => hit when nothing comes back).
class IcdGoldenSetTest extends TestCase
{
    private const TOP3_FLOOR = 0.80;

    public function test_golden_set_hit_rates(): void
    {
        $cases = json_decode(file_get_contents(base_path('tests/ai/golden/icd/cases.json')), true, flags: JSON_THROW_ON_ERROR)['cases'];
        $this->assertGreaterThanOrEqual(20, count($cases));
        [$n, $top1, $top3, $misses] = [0, 0, 0, []];
        foreach ($cases as $c) {
            $this->assertNotSame('', $c['source']);
            foreach ($c['expected'] as $system => $expected) {
                $got = array_map(fn (IcdCandidate $x) => $x->entry->code, app(IcdSearch::class)->search($c['query'], IcdSystem::from($system)));
                $this->assertNotContains('K02.5', $got);
                $n++;
                $h1 = $expected === [] ? $got === [] : in_array($got[0] ?? null, $expected, true);
                $h3 = $expected === [] ? $got === [] : array_intersect(array_slice($got, 0, 3), $expected) !== [];
                $top1 += (int) $h1;
                $top3 += (int) $h3;
                if (! $h3) {
                    $misses[] = "{$c['id']}/$system";
                }
            }
        }
        $r1 = $top1 / $n;
        $r3 = $top3 / $n;
        fwrite(STDERR, sprintf("\n[ICD golden set] %d kasus, %d cek: top-1 %.2f (%d/%d), top-3 %.2f (%d/%d); meleset: %s\n",
            count($cases), $n, $r1, $top1, $n, $r3, $top3, $n, implode(', ', $misses) ?: '-'));
        $this->assertGreaterThanOrEqual(self::TOP3_FLOOR, $r3);
    }
}
