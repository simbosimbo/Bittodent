<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Clinical\Contracts\IcdSystem;
use InvalidArgumentException;

// Reads official-format CSV (header code,display,version) into icd_entry rows. Version decides the system. No repair:
// a row with an unknown version or a code that does not fit the format is an error, never guessed.
final class IcdCsv
{
    public const VERSIONS = ['ICD10_2010' => IcdSystem::Icd10, 'ICD9CM_2010' => IcdSystem::Icd9cm];

    /** @return list<array{system: string, code: string, display: string, version: string}> */
    public static function entries(string $file): array
    {
        $rows = [];
        foreach (self::read($file, ['code', 'display', 'version']) as $line => $r) {
            $system = self::VERSIONS[$r['version']] ?? throw new InvalidArgumentException("$file:$line versi tidak dikenal");
            if (! $system->validFormat($r['code']) && ! preg_match('/^[0-9]{2}$/', $r['code'])) {
                throw new InvalidArgumentException("$file:$line format kode tidak cocok dengan $r[version]");
            }
            $rows[] = ['system' => $system->value, 'code' => $r['code'], 'display' => $r['display'], 'version' => $r['version']];
        }

        return $rows;
    }

    /** @return array<int, array<string, string>> line number => row keyed by header */
    public static function read(string $file, array $header): array
    {
        $h = fopen($file, 'r') ?: throw new InvalidArgumentException("$file tidak bisa dibaca");
        $first = array_map(fn ($c) => strtolower(trim((string) $c, "\u{FEFF} \r")), fgetcsv($h, escape: '') ?: []);
        if ($first !== $header) {
            throw new InvalidArgumentException("$file: header harus ".implode(',', $header));
        }
        $rows = [];
        for ($line = 2; ($r = fgetcsv($h, escape: '')) !== false; $line++) {
            if ($r === [null] || implode('', $r) === '') {
                continue;
            }
            $rows[$line] = array_combine($header, array_map(fn ($c) => trim((string) $c, " \r"), array_pad($r, count($header), '')));
        }
        fclose($h);

        return $rows;
    }
}
