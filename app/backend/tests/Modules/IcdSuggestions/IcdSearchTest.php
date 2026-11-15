<?php

namespace Tests\Modules\IcdSuggestions;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdCandidate;
use App\Modules\IcdSuggestions\Contracts\IcdDictionary;
use App\Modules\IcdSuggestions\Contracts\IcdSearch;
use App\Modules\IcdSuggestions\Contracts\MatchKind;
use App\Modules\IcdSuggestions\Models\IcdCode;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IcdSearchTest extends TestCase
{
    private function codes(string $q, ?IcdSystem $s = null, int $limit = 40): array
    {
        return array_map(fn (IcdCandidate $c) => $c->entry->code, app(IcdSearch::class)->search($q, $s, $limit));
    }

    public function test_synonym_gigi_berlubang_ranks_k02_and_never_k02_5(): void
    {
        $this->assertSame(['K02.1', 'K02.9'], array_slice($this->codes('gigi berlubang', IcdSystem::Icd10), 0, 2));
        $this->assertNotContains('K02.5', $this->codes('karies dengan pulpa terbuka K02.5'));
        $c = app(IcdSearch::class)->search('Gigi BERLUBANG!', IcdSystem::Icd10)[0];
        $this->assertSame([MatchKind::Synonym, 'gigi berlubang', 'Caries of dentine', 'ICD10_2010', true],
            [$c->why, $c->matchedTerm, $c->entry->display, $c->entry->version, $c->entry->perluDicek]);
    }

    public function test_cabut_ranks_23_09_and_multiword_terms_beat_single_words(): void
    {
        $this->assertSame('23.09', $this->codes('cabut', IcdSystem::Icd9cm)[0]);
        $this->assertSame('23.01', $this->codes('cabut gigi susu 75', IcdSystem::Icd9cm)[0]);
        $this->assertSame('K02.1', $this->codes('karies dentin 36', IcdSystem::Icd10)[0]);
        $this->assertSame('K01.1', $this->codes('impaksi gigi bungsu kanan bawah', IcdSystem::Icd10)[0]);
    }

    public function test_exact_code_first_and_tooth_numbers_are_not_codes(): void
    {
        $r = app(IcdSearch::class)->search('k04.1 gigi 23');
        $this->assertSame(['K04.1', MatchKind::ExactCode], [$r[0]->entry->code, $r[0]->why]);
        $this->assertNotContains('23', array_map(fn ($c) => $c->entry->code, $r));
        $this->assertSame([], $this->codes('Z99.9 99.99'));   // valid format, not in the dictionary: never invented
        $this->assertSame('96.54', $this->codes('96.54')[0]);
    }

    public function test_typo_and_fulltext_on_english_display(): void
    {
        $r = app(IcdSearch::class)->search('gigi berlobang', IcdSystem::Icd10);
        $this->assertSame(['K02.1', MatchKind::SynonymTypo], [$r[0]->entry->code, $r[0]->why]);
        $this->assertSame('96.54', $this->codes('scalling rahang atas', IcdSystem::Icd9cm)[0]);
        $r = app(IcdSearch::class)->search('chronic periodontitis');
        $this->assertSame(['K05.3', MatchKind::Fulltext], [$r[0]->entry->code, $r[0]->why]);
    }

    public function test_deterministic_limited_and_empty(): void
    {
        $this->assertSame($this->codes('gigi berlubang sakit karies dentin abses'), $this->codes('gigi berlubang sakit karies dentin abses'));
        $this->assertCount(1, $this->codes('gigi berlubang', null, 1));
        $this->assertLessThanOrEqual(40, count($this->codes('teeth tooth dental caries gigi', null, 500)));
        $this->assertSame([], $this->codes('   ...  '));
        $this->assertSame([], $this->codes('xyzzy'));
    }

    public function test_dictionary_lookup_and_app_role_cannot_write_global_tables(): void
    {
        $d = app(IcdDictionary::class);
        $this->assertSame('Retained dental root', $d->find(IcdSystem::Icd10, 'K08.3')?->display);
        $this->assertTrue($d->exists(IcdSystem::Icd9cm, '23.11'));
        $this->assertFalse($d->exists(IcdSystem::Icd10, 'K02.5'));
        $this->assertSame(['ICD9CM_2010'], $d->versions(IcdSystem::Icd9cm));
        $this->assertSame(IcdCode::count(), IcdCode::where('perlu_dicek', true)->count());

        $this->expectException(QueryException::class);
        DB::connection('mysql')->transaction(fn () => IcdCode::create(['system' => 'icd10', 'code' => 'K99.9', 'display' => 'x', 'version' => 'ICD10_2010']));
    }

    public function test_import_stub_without_path_explains_and_with_official_fixture_upserts_verbatim(): void
    {
        $this->artisan('icd:import')->expectsOutputToContain('satusehat.kemkes.go.id')->assertSuccessful();
        $before = IcdCode::count();

        $this->artisan('icd:import', ['--path' => base_path('tests/fixtures/icd')])->assertSuccessful();
        $row = IcdCode::on('mysql_admin')->where('system', 'icd10')->where('code', 'K14.6')->firstOrFail();
        $this->assertSame(['Glossodynia', 'ICD10_2010', true], [$row->display, $row->version, $row->perlu_dicek]);
        $this->assertSame('Fitting of denture', IcdCode::on('mysql_admin')->where('code', '99.97')->value('display'));
        $this->assertGreaterThan($before, IcdCode::on('mysql_admin')->count());

        $this->artisan('icd:import', ['--path' => base_path('tests/fixtures/icd/missing.csv')])->assertFailed();
    }
}
