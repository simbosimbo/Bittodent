<?php

namespace App\Shared\Terminology;

use RuntimeException;

// One CSV file, or every *.csv in a directory. The target table is chosen per row by VERSION.
final class CsvIcdSource implements IcdSource
{
    public function __construct(private string $path) {}

    public function rows(): iterable
    {
        $files = is_dir($this->path) ? glob(rtrim($this->path, '/').'/*.csv') : [$this->path];
        if ($files === [] || ! is_file($files[0])) {
            throw new RuntimeException("Berkas ICD tidak ditemukan: {$this->path}");
        }
        foreach ($files as $file) {
            yield from IcdRows::fromTable(self::csv($file), basename($file));
        }
    }

    private static function csv(string $file): \Generator
    {
        $h = fopen($file, 'r');
        try {
            while (($row = fgetcsv($h, escape: '')) !== false) {
                yield $row;
            }
        } finally {
            fclose($h);
        }
    }
}
