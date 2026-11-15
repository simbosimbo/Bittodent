<?php

namespace Tests\Feature;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Http\Middleware\SecurityHeaders;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// Staging readiness: health/readiness probes, HTTPS + security headers, SPA at "/", staging:seed guards, scheduler.
class DeployReadinessTest extends TestCase
{
    private function asStaging(): void
    {
        $this->app['env'] = 'staging';
        config(['ehr.force_https' => true]);
    }

    public function test_liveness_and_readiness_need_no_auth_and_leak_nothing(): void
    {
        $this->get('/up')->assertOk();
        $this->get('/ready')->assertOk()->assertExactJson(['status' => 'ok'])->assertCookieMissing(config('session.cookie'));

        // Unreachable database: 503 with no host, user or SQL text in the body.
        config(['database.connections.down' => ['driver' => 'mysql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'x',
            'username' => 'nobody', 'password' => 'x'], 'database.default' => 'down']);
        $this->get('/ready')->assertStatus(503)->assertExactJson(['status' => 'unavailable']);
    }

    public function test_local_keeps_plain_http_and_skips_hsts(): void
    {
        $r = $this->get('http://127.0.0.1/ready')->assertOk();
        $r->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_staging_forces_https_and_sets_security_headers(): void
    {
        $this->asStaging();

        $this->get('http://staging.example.com/api/me?x=1')->assertStatus(301)
            ->assertRedirect('https://staging.example.com/api/me?x=1');
        $this->get('http://staging.example.com/up')->assertOk(); // load balancer probe over internal HTTP

        $r = $this->get('https://staging.example.com/ready')->assertOk();
        $r->assertHeader('Strict-Transport-Security', 'max-age=31536000')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy', SecurityHeaders::CSP);

        // API keeps its own no-store header next to the security headers.
        $this->as('dokter@senyum.test')->get('https://staging.example.com/api/me')
            ->assertHeader('X-Frame-Options', 'DENY')->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_spa_index_is_served_at_root_without_shadowing_other_routes(): void
    {
        $dir = public_path('client');
        $index = "$dir/index.html";
        $existed = is_file($index);
        if (! $existed) {
            @mkdir($dir, 0775, true);
            file_put_contents($index, '<!doctype html><div id="root"></div>');
        }
        try {
            $r = $this->get('/')->assertOk()->assertHeader('X-Frame-Options', 'DENY');
            $this->assertStringContainsString('id="root"', $r->baseResponse->getFile()->getContent());
            $this->assertStringStartsWith('text/html', $r->headers->get('Content-Type'));
            $r->assertCookieMissing(config('session.cookie'));
        } finally {
            if (! $existed) {
                unlink($index);
                @rmdir($dir);
            }
        }
        $this->get('/up')->assertOk();
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_staging_seed_refuses_outside_staging_even_with_force(): void
    {
        foreach (['production', 'local', 'testing'] as $env) {
            $this->app['env'] = $env;
            $this->artisan('staging:seed', ['--force' => true])->assertExitCode(1);
        }
    }

    public function test_staging_seed_refuses_when_data_already_exists(): void
    {
        $this->app['env'] = 'staging';
        $users = User::count();

        $this->artisan('staging:seed')->assertExitCode(1);
        // --force never re-seeds over the built-in synthetic accounts.
        $this->artisan('staging:seed', ['--force' => true])->assertExitCode(1);
        $this->assertSame($users, User::count());
    }

    private const DEMO_PASSWORD = 'staging-demo-sandi-panjang-1';

    private const DEMO_TOTP = 'KRSXG5CTMVRXEZLUKRSXG5CT';

    private function emptyStagingDatabase(): void
    {
        // Empty the account tables inside the test transaction (rolled back afterwards); FK checks off only for this session.
        $admin = DB::connection('mysql_admin');
        $admin->statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            $admin->table('users')->delete();
            $admin->table('tenant')->delete();
        } finally {
            $admin->statement('SET FOREIGN_KEY_CHECKS=1');
        }
        $this->assertFalse(Tenant::on('mysql_admin')->exists());
        $this->app['env'] = 'staging';
    }

    public function test_staging_seed_seeds_an_empty_staging_database_with_env_credentials_it_never_prints(): void
    {
        $this->emptyStagingDatabase();
        config(['ehr.staging_demo_password' => self::DEMO_PASSWORD, 'ehr.staging_demo_totp_secret' => self::DEMO_TOTP]);

        $this->artisan('staging:seed')->expectsOutputToContain('AKUN PALSU')
            ->doesntExpectOutputToContain(self::DEMO_PASSWORD)->doesntExpectOutputToContain(self::DEMO_TOTP)
            ->doesntExpectOutputToContain(DatabaseSeeder::PASSWORD)->assertExitCode(0);

        $owner = User::on('mysql_admin')->where('email', 'pemilik@senyum.test')->firstOrFail();
        $this->assertSame(2, Tenant::on('mysql_admin')->count());
        $this->assertTrue(Hash::check(self::DEMO_PASSWORD, $owner->password));
        $this->assertFalse(Hash::check(DatabaseSeeder::PASSWORD, $owner->password));
        $this->assertSame(self::DEMO_TOTP, decrypt($owner->two_factor_secret));
        $this->assertNotContains('dev-recovery-1', json_decode(decrypt($owner->two_factor_recovery_codes), true));
    }

    public static function badDemoCredentials(): array
    {
        $ok = ['p' => 'staging-demo-sandi-panjang-1', 't' => 'KRSXG5CTMVRXEZLUKRSXG5CT'];

        return [
            'missing both' => [null, null],
            'missing password' => [null, $ok['t']],
            'short password' => ['pendek-123', $ok['t']],
            'dev password' => [DatabaseSeeder::PASSWORD, $ok['t']],
            'missing totp' => [$ok['p'], null],
            'dev totp' => [$ok['p'], DatabaseSeeder::TOTP_SECRET],
            'short totp' => [$ok['p'], 'KRSXG5CTMVRX'],
            'not base32' => [$ok['p'], 'krsxg5ctmvrxezlu-0189'],
        ];
    }

    #[DataProvider('badDemoCredentials')]
    public function test_staging_seed_refuses_missing_weak_or_dev_credentials(?string $password, ?string $totp): void
    {
        $this->emptyStagingDatabase();
        config(['ehr.staging_demo_password' => $password, 'ehr.staging_demo_totp_secret' => $totp]);

        $this->artisan('staging:seed')->assertExitCode(1);
        $this->assertFalse(User::on('mysql_admin')->exists());
    }

    public function test_queue_worker_is_scheduled_only_when_enabled(): void
    {
        $events = collect(app(Schedule::class)->events())->filter(fn ($e) => str_contains($e->command, 'queue:work --stop-when-empty --max-time=50 --tries=3'));
        $this->assertCount(1, $events);
        $worker = $events->first();
        $this->assertSame('* * * * *', $worker->expression);
        $this->assertTrue($worker->withoutOverlapping);

        // schedule:run skips an event whose filters fail.
        config(['ehr.queue_via_scheduler' => false]);
        $this->assertFalse($worker->filtersPass($this->app));
        config(['ehr.queue_via_scheduler' => true]);
        $this->assertTrue($worker->filtersPass($this->app));
    }

    public function test_reminders_are_on_the_scheduler_and_dev_helpers_stay_local(): void
    {
        $events = collect(app(Schedule::class)->events())->filter(fn ($e) => str_contains($e->command, 'recall:send-reminders'));
        $this->assertCount(1, $events);
        $this->assertSame('*/15 * * * *', $events->first()->expression);

        $this->app['env'] = 'staging';
        $this->artisan('dev:totp', ['email' => 'dokter@senyum.test'])->assertExitCode(1);
        $this->artisan('dev:reset')->assertExitCode(1);
    }
}
