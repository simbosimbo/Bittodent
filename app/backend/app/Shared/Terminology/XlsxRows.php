<?php

namespace App\Shared\Terminology;

use RuntimeException;
use ZipArchive;

// Minimal reader for the first sheet of an xlsx (as exported by Google Sheets). Text cells only: a numeric cell is
// rejected because Excel numbers lose leading/trailing zeros (23.10 -> 23.1) and would silently change a code.
final class XlsxRows
{
    /** @return list<list<string>> rows of the first sheet, cells placed by column letter */
    public static function read(string $path, string $label): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException("$label: bukan berkas xlsx yang valid.");
        }
        try {
            $strings = [];
            if (($xml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
                foreach (simplexml_load_string($xml)->si as $si) {
                    $s = (string) $si->t;
                    foreach ($si->r as $run) {
                        $s .= (string) $run->t;
                    }
                    $strings[] = $s;
                }
            }
            // shortcut: assumes the first sheet is xl/worksheets/sheet1.xml (true for Google exports); resolve workbook rels if another producer is used.
            $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
            if ($sheet === false) {
                throw new RuntimeException("$label: sheet pertama tidak ditemukan.");
            }
            $rows = [];
            foreach (simplexml_load_string($sheet)->sheetData->row as $row) {
                $cells = [];
                foreach ($row->c as $c) {
                    $col = 0;
                    foreach (str_split(preg_replace('/\d+/', '', (string) $c['r'])) as $ch) {
                        $col = $col * 26 + ord($ch) - 64;
                    }
                    $cells[$col - 1] = match ((string) $c['t']) {
                        's' => $strings[(int) $c->v] ?? '',
                        'inlineStr' => (string) $c->is->t,
                        'str' => (string) $c->v,
                        default => isset($c->v) ? throw new RuntimeException("$label: sel {$c['r']} berupa angka, bukan teks.") : '',
                    };
                }
                $rows[] = $cells === [] ? [] : array_replace(array_fill(0, max(array_keys($cells)) + 1, ''), $cells);
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }
}
