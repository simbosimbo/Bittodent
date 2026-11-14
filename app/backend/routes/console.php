<?php

use App\Modules\Identity\Models\User;
use App\Modules\Recall\Services\ReminderService;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;
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
