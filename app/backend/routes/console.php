<?php

use App\Modules\Identity\Models\User;
use App\Modules\Patients\Services\PatientCareStateService;
use App\Modules\Recall\Services\ReminderService;
use App\Modules\Scheduling\Services\FakeOtpSender;
use App\Modules\Scribe\Contracts\ScribeEngine;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\CsvIcdSource;
use App\Shared\Terminology\IcdImporter;
use App\Shared\Terminology\SatusehatApiSource;
use App\Shared\Terminology\SatusehatSpreadsheetSource;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use PragmaRX\Google2FA\Google2FA;

// Dev helper: print the current TOTP code of a seeded synthetic account. Local only (not staging, not production).
Artisan::command('dev:totp {email}', function (string $email) {
    if (! app()->environment('local')) {
        $this->error('dev:totp hanya untuk APP_ENV=local.');

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

// First synthetic seed of a fresh staging database (after `migrate --database=mysql_admin --force`). Non-destructive:
// no migrate:fresh, never outside APP_ENV=staging (not even with --force), never twice over the built-in synthetic accounts.
Artisan::command('staging:seed {--force : seed walau sudah ada tenant/pengguna lain (tetap ditolak bila akun sintetis *.test sudah ada)}', function () {
    if (! app()->environment('staging')) {
        $this->error('staging:seed hanya untuk APP_ENV=staging (sekarang: '.app()->environment().'). Lokal: php artisan dev:reset.');

        return 1;
    }
    // Check on the connection that will write (ehr_admin), not the runtime one.
    if (User::on('mysql_admin')->where('email', 'like', '%.test')->exists()) {
        $this->error('Akun sintetis (*.test) sudah ada. staging:seed tidak menimpa atau menggandakan data; tidak ada yang diubah.');

        return 1;
    }
    if ((Tenant::on('mysql_admin')->exists() || User::on('mysql_admin')->exists()) && ! $this->option('force')) {
        $this->error('Database sudah berisi tenant/pengguna. Tidak ada yang diubah. Pakai --force hanya jika yakin semuanya data sintetis.');

        return 1;
    }
    // A public URL must not accept the documented dev credentials: both come from env, are validated, and are never printed.
    $password = (string) config('ehr.staging_demo_password');
    $totp = (string) config('ehr.staging_demo_totp_secret');
    if (strlen($password) < 16 || $password === DatabaseSeeder::PASSWORD) {
        $this->error('STAGING_DEMO_PASSWORD wajib diisi (min. 16 karakter, bukan kata sandi dev). Tidak ada yang diubah.');

        return 1;
    }
    if (! preg_match('/^[A-Z2-7]{16,}$/', $totp) || $totp === DatabaseSeeder::TOTP_SECRET) {
        $this->error('STAGING_DEMO_TOTP_SECRET wajib diisi (base32 A-Z/2-7, min. 16 karakter, bukan secret contoh dev). Tidak ada yang diubah.');

        return 1;
    }
    app()->when(DatabaseSeeder::class)->needs('$password')->give($password);
    app()->when(DatabaseSeeder::class)->needs('$totpSecret')->give($totp);
    $this->call('db:seed', ['--database' => 'mysql_admin', '--force' => true]);
    $this->newLine();
    $this->warn('AKUN PALSU (data sintetis). Jangan dipakai untuk data pasien asli. Kata sandi = STAGING_DEMO_PASSWORD, '
        .'TOTP secret = STAGING_DEMO_TOTP_SECRET (dari env server; tidak dicetak).');
    $this->table(['Email', 'Nama'], User::on('mysql_admin')->where('email', 'like', '%.test')->orderBy('email')->get(['email', 'name'])->toArray());

    return 0;
})->purpose('Seed data sintetis pertama kali di staging (hanya APP_ENV=staging, tidak menghapus data)');

// Appointment reminders (no-op channel): one pass per tenant, each in its own tenant context. Safe to run twice (reminder_log key).
Artisan::command('recall:send-reminders', function () {
    foreach (Tenant::pluck('id') as $tenantId) {
        $n = Ctx::runAs($tenantId, fn () => count(app(ReminderService::class)->sendDue(CarbonImmutable::now())));
        $this->line("$tenantId: $n");
    }
})->purpose('Kirim pengingat janji yang jatuh tempo (kanal no-op; tercatat di reminder_log)');
// Reminders are due H-1 and 2 hours before the start; every 15 minutes keeps them at most ~15 min late.
// Needs a scheduler process: `php artisan schedule:work` (Docker) or cron `* * * * * php artisan schedule:run` (Forge/VPS).
Schedule::command('recall:send-reminders')->everyFifteenMinutes()->withoutOverlapping();
// Shared hosting without a long-running worker (QUEUE_VIA_SCHEDULER=true): drain the queue each minute from the one
// `schedule:run` cron line. --max-time=50 ends before the next run; withoutOverlapping guards a slow job.
Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')->everyMinute()->withoutOverlapping()
    ->when(fn () => (bool) config('ehr.queue_via_scheduler'));

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

// Care status depends on time (appointments pass, visits age past 30 days / 12 months): recompute from stored facts, per tenant.
Artisan::command('patients:refresh-care-status', function () {
    foreach (Tenant::pluck('id') as $tenantId) {
        $this->line("$tenantId: ".Ctx::runAs($tenantId, fn () => app(PatientCareStateService::class)->refreshAll()));
    }
})->purpose('Hitung ulang status perawatan pasien (daftar pasien) dari fakta tersimpan');
Schedule::command('patients:refresh-care-status')->dailyAt('00:10')->timezone('Asia/Jakarta')->withoutOverlapping();

// Dev helper: last booking OTP sent to a number by the `fake` driver (BOOKING_OTP_DRIVER=fake). Never in production.
Artisan::command('booking:otp {phone}', function (string $phone) {
    if (app()->isProduction() || config('ehr.booking.otp_driver') !== 'fake') {
        $this->error('booking:otp hanya untuk BOOKING_OTP_DRIVER=fake di luar production.');

        return 1;
    }
    $code = FakeOtpSender::lastCode($phone);
    $code === null ? $this->error('Belum ada kode (atau sudah lewat 5 menit).') : $this->line($code);

    return $code === null ? 1 : 0;
})->purpose('Cetak kode OTP booking terakhir (driver fake, data sintetis)');

Artisan::command('scribe:wipe-expired-audio', function () {
    $n = 0;
    foreach (Tenant::pluck('id') as $tenantId) {
        $n += Ctx::runAs($tenantId, fn () => app(ScribeEngine::class)->sweepExpiredAudio(now()));
    }
    $this->line((string) $n);
})->purpose('Hapus audio scribe yang gagal diproses lebih dari 24 jam');
Schedule::command('scribe:wipe-expired-audio')->everyFifteenMinutes()->timezone('Asia/Jakarta')->withoutOverlapping();
