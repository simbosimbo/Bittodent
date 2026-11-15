<?php

namespace App\Shared\Terminology;

use RuntimeException;

// Turns a raw table (first row = header with CODE, DISPLAY, VERSION in any order/case) into [code, display, version] rows.
// Empty rows are skipped; a half-filled row is an error (never guess missing official text).
final class IcdRows
{
    /** @param iterable<list<string|null>> $table */
    public static function fromTable(iterable $table, string $label): \Generator
    {
        $cols = null;
        foreach ($table as $i => $raw) {
            $raw = array_map(fn ($v) => trim((string) $v), $raw);
            if ($cols === null) {
                $cols = array_map(fn ($h) => array_search($h, array_map('strtoupper', $raw), true), ['CODE', 'DISPLAY', 'VERSION']);
                if (in_array(false, $cols, true)) {
                    throw new RuntimeException("$label: kolom CODE, DISPLAY, VERSION tidak ditemukan di baris judul.");
                }

                continue;
            }
            $row = array_map(fn ($c) => $raw[$c] ?? '', $cols);
            if (implode('', $row) === '') {
                continue;
            }
            if (in_array('', $row, true)) {
                throw new RuntimeException("$label: baris ".($i + 1).' tidak lengkap (CODE/DISPLAY/VERSION wajib terisi).');
            }
            yield $row;
        }
        if ($cols === null) {
            throw new RuntimeException("$label: berkas kosong.");
        }
    }
}
