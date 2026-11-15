<?php

namespace Tests\Modules\ClinicalSummary;

use App\Modules\ClinicalSummary\Domain\Generator;
use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Domain\SummaryClaim;
use App\Modules\ClinicalSummary\Domain\SummarySection;
use App\Modules\ClinicalSummary\Domain\SummarySources;
use App\Modules\ClinicalSummary\Services\DeterministicSummarizer;
use App\Modules\ClinicalSummary\Services\SourceCollector;
use App\Shared\Tenancy\Ctx;
use InvalidArgumentException;
use Tests\TestCase;

// Unit 2: summary without AI, from structured + signed data only, every line cited (id + version).
class DeterministicSummaryTest extends TestCase
{
    /** @return array{0: array<string, list<SummaryClaim>>, 1: SummarySources} */
    private function build(): array
    {
        $p = $this->patientOf($this->tenantA());

        return Ctx::runAs($this->tenantA()->id, function () use ($p) {
            $src = app(SourceCollector::class)->collect($p->id, new HistoryScope);
            $d = app(DeterministicSummarizer::class);
            $sections = [...$d->narrative($src), ...$d->structured($src)];
            $this->assertContainsOnly(SummarySection::class, $sections);
            foreach ($sections as $s) {
                $this->assertSame(Generator::Deterministik, $s->generator);
            }

            return [collect($sections)->mapWithKeys(fn ($s) => [$s->kind->value => $s->claims])->all(), $src];
        });
    }

    public function test_allergies_medication_and_odontogram_are_exact_copies_of_structured_data(): void
    {
        [$by] = $this->build();
        $med = array_map(fn ($c) => $c->text, $by['alergi_obat']);
        $this->assertContains('Alergi: Penisilin, Lateks', $med);
        $this->assertContains('Obat yang diminum: Warfarin (contoh)', $med);
        $this->assertContains('Premedikasi: perlu', $med);
        $this->assertStringNotContainsString('dokter jantung', implode("\n", $med)); // urgent note text never copied

        $teeth = array_map(fn ($c) => $c->text, $by['odontogram']);
        $this->assertSame(['Gigi 11 I: karies, status kondisi_pantau', 'Gigi 18: perlu_dicabut, status direncanakan (23.09)',
            'Gigi 46 O: tambalan, status selesai (23.2)', 'Keadaan dasar gigi (tetap): 38 hilang, 48 belum_tumbuh'], $teeth);
    }

    public function test_narrative_uses_signed_effective_versions_only(): void
    {
        [$by] = $this->build();
        $all = implode("\n", array_map(fn ($c) => $c->text, [...$by['keluhan'], ...$by['diagnosis'], ...$by['tindakan']]));
        $this->assertStringContainsString('K02.1 — Karies dentin', $all);
        $this->assertStringContainsString('K05.3 — Periodontitis kronis', $all);
        $this->assertStringContainsString('23.2 — Tumpatan komposit.', $all);
        $this->assertStringNotContainsString('Gigi depan atas berlubang', $all); // draft note
        $this->assertStringNotContainsString('K02.0', $all);
    }

    public function test_every_claim_cites_a_source_that_was_read(): void
    {
        [$by, $src] = $this->build();
        $known = collect($src->refs())->map(fn ($r) => "{$r['type']}:{$r['id']}:{$r['version']}")->all();
        $n = 0;
        foreach ($by as $claims) {
            foreach ($claims as $c) {
                $this->assertNotEmpty($c->citations);
                foreach ($c->citations as $cit) {
                    $this->assertContains("{$cit->type->value}:{$cit->sourceId}:{$cit->version}", $known);
                    $n++;
                }
            }
        }
        $this->assertGreaterThan(10, $n);
    }

    public function test_scope_limits_are_enforced(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new HistoryScope(months: 61);
    }
}
