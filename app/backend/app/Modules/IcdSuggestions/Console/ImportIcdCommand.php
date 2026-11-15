<?php

namespace App\Modules\IcdSuggestions\Console;

use App\Modules\IcdSuggestions\Models\IcdCode;
use App\Modules\IcdSuggestions\Services\IcdCsv;
use Illuminate\Console\Command;
use InvalidArgumentException;

// STUB importer: upserts a LOCAL official-format CSV (code,display,version) into icd_entry as mysql_admin. Never downloads,
// never invents rows. The full official dictionary is not vendored here (database/data/icd/SOURCE.md). Not a replacement for PR #25.
class ImportIcdCommand extends Command
{
    protected $signature = 'icd:import {--path= : berkas CSV atau folder berisi CSV resmi (code,display,version)}';

    protected $description = 'Impor kamus ICD resmi dari CSV lokal (tanpa unduh).';

    public function handle(): int
    {
        $path = (string) $this->option('path');
        if ($path === '') {
            $this->warn('Kamus ICD resmi lengkap tidak disertakan di repo ini; yang ada hanya contoh kecil (perlu dicek).');
            $this->line('Unduh dokumen resmi dari SATUSEHAT (lihat database/data/icd/SOURCE.md):');
            $this->line('  https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-10/');
            $this->line('  https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-9-cm/');
            $this->line('Ekspor ke CSV code,display,version lalu jalankan: php artisan icd:import --path=<berkas atau folder>');

            return self::SUCCESS;
        }
        $files = is_dir($path) ? glob(rtrim($path, '/').'/*.csv') : [$path];
        if ($files === [] || ! is_file($files[0])) {
            $this->error("Tidak ada CSV di $path");

            return self::FAILURE;
        }
        $total = 0;
        foreach ($files as $f) {
            try {
                $rows = IcdCsv::entries($f);
            } catch (InvalidArgumentException $e) {
                $this->error($e->getMessage());

                return self::FAILURE;
            }
            foreach (array_chunk($rows, 1000) as $chunk) {
                IcdCode::on('mysql_admin')->upsert(array_map(fn ($r) => $r + ['perlu_dicek' => true], $chunk), ['system', 'code'], ['display', 'version']);
            }
            $this->info(basename($f).': '.count($rows).' kode');
            $total += count($rows);
        }
        $this->info("Selesai: $total kode (tetap ditandai perlu dicek).");

        return self::SUCCESS;
    }
}
