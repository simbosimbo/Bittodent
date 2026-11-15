<?php

use App\Modules\Identity\Models\User;
use App\Modules\Recall\Services\ReminderService;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\CsvIcdSource;
use App\Shared\Terminology\IcdImporter;
use App\Shared\Terminology\SatusehatApiSource;
use App\Shared\Terminology\SatusehatSpreadsheetSource;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use PragmaRX\Google2FA\Google2FA;

// Dev helper: print the current TOTP code of a seeded synthetic account. Never in production.
Artisan::command('dev:totp {email}', function (string $email) {
    if (app()->isProduction()) {
        $this->error('dev:totp ditolak di production.');

        return 1;
    }
    $user = User::where('email', $email)->first();
    if (! $user?->two_factor_secret) {
        $this->error('Pengguna tidak ada atau belum punya TOTP.');

        return 1;
    }
    $this->line(app(Google2FA::class)->getCurrentOtp(decrypt($user->two_factor_secret)));

    return 0;
})->purpose('Cetak kode TOTP saat ini untuk akun dev (data sintetis)');

// Dev helper: wipe ehr_dev, migrate as ehr_admin (schema + ehr_app grants + triggers), seed synthetic data, print accounts.
Artisan::command('dev:reset', function () {
    $db = config('database.connections.mysql_admin.database');
    if (! app()->environment('local') || ! in_array($db, ['ehr_dev', 'ehr_test'], true)) {
        $this->error('dev:reset hanya untuk APP_ENV=local dan database ehr_dev/ehr_test (sekarang: env='.app()->environment().", db=$db).");

        return 1;
    }
    $this->call('migrate:fresh', ['--database' => 'mysql_admin', '--seed' => true, '--force' => true]);
    $this->newLine();
    $this->info('Akun dev (data sintetis). Kata sandi: '.DatabaseSeeder::PASSWORD.' | TOTP secret: '.DatabaseSeeder::TOTP_SECRET);
    $this->table(['Email', 'Nama'], User::where('email', 'like', '%.test')->orderBy('email')->get(['email', 'name'])->toArray());
    $this->line('Kode TOTP: php artisan dev:totp <email>'.(config('ehr.dev_quick_login') ? ' | Masuk cepat (dev) aktif di layar login.' : ' | Masuk cepat: set DEV_QUICK_LOGIN=true di .env'));

    return 0;
})->purpose('Reset + seed database dev (hanya APP_ENV=local, ehr_dev/ehr_test)');

// Appointment reminders (no-op channel): one pass per tenant, each in its own tenant context. Safe to run twice (reminder_log key).
Artisan::command('recall:send-reminders', function () {
    foreach (Tenant::pluck('id') as $tenantId) {
        $n = Ctx::runAs($tenantId, fn () => count(app(ReminderService::class)->sendDue(CarbonImmutable::now())));
        $this->line("$tenantId: $n");
    }
})->purpose('Kirim pengingat janji yang jatuh tempo (kanal no-op; tercatat di reminder_log)');

// Official ICD-10 2010 / ICD-9-CM 2010 reference lists (global tables, written as ehr_admin). Safe to run twice.
Artisan::command('icd:import {--source=file : file (CSV lokal) | satusehat (API FHIR, butuh kredensial) | satusehat-spreadsheet (spreadsheet publik resmi)} {--path= : berkas/folder CSV (default database/data/icd)} {--fallback= : hanya untuk --source=satusehat: spreadsheet = pakai spreadsheet publik bila API gagal} {--force : izinkan di production}', function (IcdImporter $importer) {
    if (app()->isProduction() && ! $this->option('force')) {
        $this->error('icd:import di production butuh --force.');

        return 1;
    }
    $source = match ($this->option('source')) {
        'file' => new CsvIcdSource($this->option('path') ?: database_path('data/icd')),
        'satusehat' => new SatusehatApiSource(config('services.satusehat')),
        'satusehat-spreadsheet' => new SatusehatSpreadsheetSource,
        default => null,
    };
    if ($source === null) {
        $this->error('--source harus file, satusehat, atau satusehat-spreadsheet.');

        return 1;
    }
    $fallback = $this->option('fallback');
    if ($fallback !== null && ($fallback !== 'spreadsheet' || ! $source instanceof SatusehatApiSource)) {
        $this->error('--fallback hanya boleh "spreadsheet" dan hanya dengan --source=satusehat.');

        return 1;
    }
    if ($source instanceof SatusehatApiSource && ($missing = $source->missing()) !== []) {
        $this->error('Konfigurasi SATUSEHAT belum lengkap/valid: '.implode(', ', $missing).'. Wajib diisi di .env: '.implode(', ', SatusehatApiSource::ENV_VARS).' (SATUSEHAT_ENV = sandbox|production).');
        $this->line('Kredensial sandbox: https://satusehat.kemkes.go.id/platform/docs/id/api-code/access-sandbox/ (daftar: https://satusehat.kemkes.go.id/platform/docs/id/registration-guide/registration/). Tidak ada data yang diubah.');

        return 1;
    }
    try {
        try {
            $counts = $importer->import($source);
        } catch (RuntimeException $e) {
            if ($fallback === null) {
                throw $e;
            }
            $this->warn($e->getMessage());
            $this->warn('--fallback=spreadsheet: impor dari spreadsheet publik resmi SATUSEHAT.');
            $counts = $importer->import(new SatusehatSpreadsheetSource);
        }
    } catch (RuntimeException $e) {
        $this->error($e->getMessage());

        return 1;
    }
    $this->table(['Tabel', 'Baru', 'Diubah', 'Jadi tidak valid', 'Tetap'],
        array_map(fn ($t, $c) => [$t, ...array_values($c)], array_keys($counts), $counts));

    return 0;
})->purpose('Impor daftar ICD-10/ICD-9-CM resmi SATUSEHAT (idempoten)');
