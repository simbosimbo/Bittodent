<?php

namespace Tests\Feature;

use App\Shared\Terminology\CsvIcdSource;
use App\Shared\Terminology\Icd10Code;
use App\Shared\Terminology\Icd9cmCode;
use App\Shared\Terminology\IcdCatalog;
use App\Shared\Terminology\IcdImporter;
use App\Shared\Terminology\SatusehatSpreadsheetSource;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Fixtures = official rows copied from database/data/icd (K00–K14; 23.x, 24.x, 87.1x, 89.3x, 96.54, 99.97). Never invented.
// Writes go through mysql_admin inside the rolled-back test transaction, so assertions read mysql_admin too.
class IcdImportTest extends TestCase
{
    private const A = IcdImporter::CONNECTION;

    private array $tmp = [];

    protected function tearDown(): void
    {
        array_map('unlink', array_filter($this->tmp, 'is_file'));
        parent::tearDown();
    }

    private function emptyTables(): void
    {
        Icd10Code::on(self::A)->delete();
        Icd9cmCode::on(self::A)->delete();
    }

    private function fixtures(): string
    {
        return base_path('tests/fixtures/icd');
    }

    /** Temp CSV built from official fixture lines (optionally filtered / with extra raw lines). */
    private function csv(string $fixture, ?callable $filter = null, array $extra = []): string
    {
        $lines = file($this->fixtures()."/$fixture", FILE_IGNORE_NEW_LINES);
        $body = [$lines[0], ...array_filter(array_slice($lines, 1), $filter ?? fn () => true), ...$extra];
        $path = $this->tmp[] = tempnam(sys_get_temp_dir(), 'icdtest').'.csv';
        file_put_contents($path, implode("\n", $body)."\n");

        return $path;
    }

    private function import(string $path): array
    {
        $this->artisan('icd:import', ['--path' => $path])->assertExitCode(0);

        return app(IcdImporter::class)->import(new CsvIcdSource($path)); // second run: must be all unchanged/no-op
    }

    private function display(string $model, string $code): ?string
    {
        return $model::on(self::A)->find($code)?->display;
    }

    public function test_import_dental_fixture_and_second_run_is_unchanged(): void
    {
        $this->emptyTables();
        $first = app(IcdImporter::class)->import(new CsvIcdSource($this->fixtures()));
        $this->assertSame(['inserted' => 123, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 0], $first['icd10_codes']);
        $this->assertSame(['inserted' => 52, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 0], $first['icd9cm_codes']);
        $this->assertSame(123, Icd10Code::on(self::A)->count());
        $this->assertSame(52, Icd9cmCode::on(self::A)->count());

        $this->assertSame('Caries of dentine', $this->display(Icd10Code::class, 'K02.1'));
        $this->assertSame('Other surgical extraction of tooth', $this->display(Icd9cmCode::class, '23.19'));
        $this->assertSame('Extraction of deciduous tooth', $this->display(Icd9cmCode::class, '23.01'));
        $this->assertSame('ICD9CM_2010', Icd9cmCode::on(self::A)->find('23.01')->version);
        $this->assertNull(Icd10Code::on(self::A)->find('K02.5'));

        $second = app(IcdImporter::class)->import(new CsvIcdSource($this->fixtures()));
        $this->assertSame(['inserted' => 0, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 123], $second['icd10_codes']);
        $this->assertSame(['inserted' => 0, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 52], $second['icd9cm_codes']);
    }

    public function test_command_skips_empty_rows_and_only_touches_tables_in_the_source(): void
    {
        $this->emptyTables();
        $path = $this->csv('icd10-dental-fixture.csv', null, ['', ',,', ' , , ']);
        $again = $this->import($path);
        $this->assertSame(123, Icd10Code::on(self::A)->count());
        $this->assertSame(['icd10_codes'], array_keys($again));
        $this->assertSame(123, $again['icd10_codes']['unchanged']);
        $this->assertSame(0, Icd9cmCode::on(self::A)->count());
    }

    public function test_update_invalidate_and_revalidate(): void
    {
        $this->emptyTables();
        $importer = app(IcdImporter::class);
        $importer->import(new CsvIcdSource($this->fixtures().'/icd10-dental-fixture.csv'));

        // later list: K02.1 missing, K02.0 display changed (test-only edit to exercise the update path)
        $later = $this->csv('icd10-dental-fixture.csv',
            fn ($l) => ! str_starts_with($l, 'K02.1,') && ! str_starts_with($l, 'K02.0,'), ['K02.0,Changed display (test),ICD10_2010']);
        $c = $importer->import(new CsvIcdSource($later));
        $this->assertSame(['inserted' => 0, 'updated' => 1, 'invalidated' => 1, 'unchanged' => 121], $c['icd10_codes']);
        $this->assertSame('Changed display (test)', $this->display(Icd10Code::class, 'K02.0'));
        $k021 = Icd10Code::on(self::A)->find('K02.1');
        $this->assertFalse($k021->valid);
        $this->assertSame('Caries of dentine', $k021->display); // kept, not deleted

        $c = $importer->import(new CsvIcdSource($this->fixtures().'/icd10-dental-fixture.csv'));
        $this->assertSame(['inserted' => 0, 'updated' => 2, 'invalidated' => 0, 'unchanged' => 121], $c['icd10_codes']);
        $this->assertTrue(Icd10Code::on(self::A)->find('K02.1')->valid);
        $this->assertSame('Caries limited to enamel', $this->display(Icd10Code::class, 'K02.0'));
    }

    public function test_bad_source_writes_nothing(): void
    {
        $before = Icd10Code::on(self::A)->count();
        foreach ([
            $this->csv('icd10-dental-fixture.csv', null, ['K02.1,,ICD10_2010']),         // half-filled row
            $this->csv('icd10-dental-fixture.csv', null, ['K02.1,Caries of dentine,ICD10_2019']), // unknown version
            $this->csv('icd10-dental-fixture.csv', null, ['K02.1,Caries of dentine,ICD10_2010']), // duplicate code
            $this->csv('icd10-dental-fixture.csv', fn () => false),                        // header only
        ] as $path) {
            $this->artisan('icd:import', ['--path' => $path])->assertExitCode(1);
        }
        $this->assertSame($before, Icd10Code::on(self::A)->where('valid', true)->count());
    }

    public function test_seed_has_full_official_lists(): void
    {
        // read as ehr_app (connection `mysql`, SELECT grant) through the catalog
        $catalog = app(IcdCatalog::class);
        $this->assertSame(18542, Icd10Code::count());
        $this->assertSame(4626, Icd9cmCode::count());
        $this->assertSame('Caries of dentine', $catalog->icd10('K02.1')?->display);
        $this->assertTrue($catalog->icd10Exists('K02.1'));
        $this->assertFalse($catalog->icd10Exists('K02.5')); // WHO 2019 code, not in ICD10_2010
        $this->assertNull($catalog->icd10('K02.5'));
        $this->assertTrue($catalog->icd9cmExists('23.19'));
        $this->assertFalse($catalog->icd9cmExists('K02.1'));
        $this->assertSame('Dental scaling, polishing, and debridement', $catalog->icd9cm('96.54')?->display);

        $again = app(IcdImporter::class)->import(new CsvIcdSource(database_path('data/icd')));
        $this->assertSame(['inserted' => 0, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 18542], $again['icd10_codes']);
        $this->assertSame(['inserted' => 0, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 4626], $again['icd9cm_codes']);
    }

    public function test_catalog_ignores_invalidated_codes(): void
    {
        $this->emptyTables();
        Icd10Code::on(self::A)->create(['code' => 'K02.1', 'display' => 'Caries of dentine', 'version' => 'ICD10_2010', 'valid' => false]);
        $this->app['db']->setDefaultConnection(self::A); // see the uncommitted row
        $this->assertFalse(app(IcdCatalog::class)->icd10Exists('K02.1'));
        $this->assertNull(app(IcdCatalog::class)->icd10('K02.1'));
    }

    /** Google-Sheets-shaped xlsx (shared strings, text cells) built from an official fixture CSV, plus an empty row. */
    private function xlsxFrom(string $fixture): string
    {
        $rows = array_map('str_getcsv', file($this->fixtures()."/$fixture", FILE_IGNORE_NEW_LINES));
        $rows[] = [];
        $strings = [];
        $xmlRows = '';
        foreach ($rows as $i => $row) {
            $cells = '';
            foreach ($row as $j => $v) {
                $strings[] = htmlspecialchars($v, ENT_XML1);
                $cells .= '<c r="'.chr(65 + $j).($i + 1).'" t="s"><v>'.(count($strings) - 1).'</v></c>';
            }
            $xmlRows .= '<row r="'.($i + 1).'">'.$cells.'</row>';
        }
        $ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
        $path = $this->tmp[] = tempnam(sys_get_temp_dir(), 'icdx').'.xlsx';
        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        $zip->addFromString('xl/sharedStrings.xml', "<sst $ns>".implode('', array_map(fn ($s) => "<si><t>$s</t></si>", $strings)).'</sst>');
        $zip->addFromString('xl/worksheets/sheet1.xml', "<worksheet $ns><sheetData>$xmlRows</sheetData></worksheet>");
        $zip->close();

        return file_get_contents($path);
    }

    public function test_satusehat_source_with_mocked_http(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            SatusehatSpreadsheetSource::URLS['ICD-10'] => Http::response($this->xlsxFrom('icd10-dental-fixture.csv')),
            SatusehatSpreadsheetSource::URLS['ICD-9-CM'] => Http::response($this->xlsxFrom('icd9-dental-fixture.csv')),
        ]);
        $this->emptyTables();
        $this->artisan('icd:import', ['--source' => 'satusehat'])->assertExitCode(0);
        $this->assertSame(123, Icd10Code::on(self::A)->count());
        $this->assertSame(52, Icd9cmCode::on(self::A)->count());
        $this->assertSame('Caries of dentine', $this->display(Icd10Code::class, 'K02.1'));
        $this->assertSame('Other surgical extraction of tooth', $this->display(Icd9cmCode::class, '23.19'));
    }

    public function test_satusehat_download_failure_writes_nothing(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            SatusehatSpreadsheetSource::URLS['ICD-10'] => Http::response($this->xlsxFrom('icd10-dental-fixture.csv')),
            SatusehatSpreadsheetSource::URLS['ICD-9-CM'] => Http::response('', 503),
        ]);
        $before = [Icd10Code::on(self::A)->where('valid', true)->count(), Icd9cmCode::on(self::A)->where('valid', true)->count()];
        $this->artisan('icd:import', ['--source' => 'satusehat'])
            ->expectsOutputToContain('Unduh ICD-9-CM dari SATUSEHAT gagal (HTTP 503)')
            ->assertExitCode(1);
        $this->assertSame($before, [Icd10Code::on(self::A)->where('valid', true)->count(), Icd9cmCode::on(self::A)->where('valid', true)->count()]);
    }

    public function test_satusehat_non_xlsx_response_is_rejected(): void
    {
        Http::preventStrayRequests();
        Http::fake(['docs.google.com/*' => Http::response('<html>login</html>')]);
        $this->artisan('icd:import', ['--source' => 'satusehat'])->expectsOutputToContain('bukan berkas xlsx')->assertExitCode(1);
    }

    public function test_production_requires_force(): void
    {
        $this->app['env'] = 'production';
        $this->artisan('icd:import')->expectsOutputToContain('--force')->assertExitCode(1);
    }
}
