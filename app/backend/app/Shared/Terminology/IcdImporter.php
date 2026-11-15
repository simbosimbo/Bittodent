<?php

namespace App\Shared\Terminology;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use RuntimeException;

// Idempotent import of the official ICD lists as ehr_admin. Upsert by code; codes missing from the incoming list get
// valid=false (never deleted, old records may reference them); a returning code becomes valid again.
// Only tables present in the source are touched. All rows are read and checked before anything is written.
final class IcdImporter
{
    public const CONNECTION = 'mysql_admin';

    /** VERSION value => model. A row with any other version is rejected. */
    public const TABLES = ['ICD10_2010' => Icd10Code::class, 'ICD9CM_2010' => Icd9cmCode::class];

    private const CHUNK = 1000;

    /** @return array<string, array{inserted: int, updated: int, invalidated: int, unchanged: int}> per table */
    public function import(IcdSource $source): array
    {
        $incoming = [];
        foreach ($source->rows() as [$code, $display, $version]) {
            if (! isset(self::TABLES[$version])) {
                throw new RuntimeException("Versi tidak dikenal '$version' (kode $code). Yang diterima: ".implode(', ', array_keys(self::TABLES)).'.');
            }
            if (isset($incoming[$version][$code])) {
                throw new RuntimeException("Kode ganda $code ($version) di sumber.");
            }
            $incoming[$version][$code] = $display;
        }
        if ($incoming === []) {
            throw new RuntimeException('Sumber ICD tidak berisi kode; tidak ada yang diimpor.');
        }

        return DB::connection(self::CONNECTION)->transaction(function () use ($incoming) {
            $counts = [];
            foreach ($incoming as $version => $rows) {
                $model = self::TABLES[$version];
                $counts[(new $model)->getTable()] = $this->importTable($model, $version, $rows);
            }

            return $counts;
        });
    }

    /** @param class-string<Model> $model */
    private function importTable(string $model, string $version, array $rows): array
    {
        $existing = $model::on(self::CONNECTION)->get(['code', 'display', 'version', 'valid'])->keyBy('code');
        $counts = ['inserted' => 0, 'updated' => 0, 'invalidated' => 0, 'unchanged' => 0];
        $write = [];
        foreach ($rows as $code => $display) {
            $old = $existing[$code] ?? null;
            $code = (string) $code; // numeric-looking keys (e.g. "00") come back as int from PHP arrays
            if ($old === null) {
                $counts['inserted']++;
            } elseif ($old->display !== $display || $old->version !== $version || ! $old->valid) {
                $counts['updated']++;
            } else {
                $counts['unchanged']++;

                continue;
            }
            $write[] = ['code' => $code, 'display' => $display, 'version' => $version, 'valid' => true];
        }
        foreach (array_chunk($write, self::CHUNK) as $chunk) {
            $model::on(self::CONNECTION)->upsert($chunk, ['code'], ['display', 'version', 'valid']);
        }

        $gone = $existing->filter(fn ($r) => $r->valid && ! array_key_exists($r->code, $rows))->keys()->all();
        foreach (array_chunk($gone, self::CHUNK) as $chunk) {
            $model::on(self::CONNECTION)->whereIn('code', $chunk)->update(['valid' => false]);
        }
        $counts['invalidated'] = count($gone);

        return $counts;
    }
}
