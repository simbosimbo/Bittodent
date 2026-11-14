<?php

namespace Tests\Modules\Identity;

use App\Modules\Identity\IdentityServiceProvider;
use App\Shared\Audit\AuthEvent;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Tests\TestCase;

class DevQuickLoginTest extends TestCase
{
    private const SPA = ['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/', 'Accept' => 'application/json'];

    /** Simulate booting with another APP_ENV / DEV_QUICK_LOGIN (routes are decided at boot). */
    private function boot(string $env, bool $flag): void
    {
        $this->app['env'] = $env;
        config(['ehr.dev_quick_login' => $flag]);
        IdentityServiceProvider::registerDevRoutes();
        $this->app['router']->getRoutes()->refreshNameLookups();
        // CSRF auto-skips only under APP_ENV=testing; token handling is not what these tests check.
        $this->withoutMiddleware(PreventRequestForgery::class);
    }

    private function assertNoDevRoutes(): void
    {
        $this->getJson('/api/dev/status')->assertNotFound();
        $this->withHeaders(self::SPA)->postJson('/dev/quick-login', ['user_email' => 'dokter@senyum.test'])->assertNotFound();
        $this->assertGuest();
    }

    public function test_404_in_default_testing_env(): void
    {
        $this->assertNoDevRoutes();
    }

    public function test_404_in_production_even_with_flag(): void
    {
        $this->boot('production', true);
        $this->assertNoDevRoutes();
    }

    public function test_404_in_local_without_flag(): void
    {
        $this->boot('local', false);
        $this->assertNoDevRoutes();
    }

    public function test_local_with_flag_logs_in_without_totp_and_audits(): void
    {
        $this->boot('local', true);
        $this->withoutMiddleware(ValidateCsrfToken::class);
        $emails = array_column($this->getJson('/api/dev/status')->assertOk()->assertJsonPath('quick_login', true)->json('accounts'), 'email');
        $this->assertContains('depan@senyum.test', $emails);

        $u = $this->user('depan@senyum.test');
        $this->withHeaders(self::SPA)->postJson('/dev/quick-login', ['user_email' => $u->email])->assertNoContent();
        $this->assertAuthenticatedAs($u);
        $this->withHeaders(self::SPA)->getJson('/api/me')->assertOk()->assertJsonPath('user.email', $u->email);
        $this->assertTrue(AuthEvent::where('user_id', $u->id)->where('action', 'dev_quick_login')->exists());
    }

    public function test_refuses_non_seed_email(): void
    {
        $this->boot('local', true);
        $this->withoutMiddleware(ValidateCsrfToken::class);
        DatabaseSeeder::user('nyata@klinik.co.id', 'Bukan Seed', 'lainnya');
        foreach (['nyata@klinik.co.id', 'tidakada@senyum.test', 'x@senyum.test.co.id'] as $email) {
            $this->withHeaders(self::SPA)->postJson('/dev/quick-login', ['user_email' => $email])->assertStatus(422);
        }
        $this->assertGuest();
    }

    public function test_normal_login_still_requires_totp_when_quick_login_is_on(): void
    {
        $this->boot('local', true);
        $this->withHeaders(self::SPA)->postJson('/login', ['email' => 'dokter@senyum.test', 'password' => DatabaseSeeder::PASSWORD])
            ->assertOk()->assertJson(['two_factor' => true]);
        $this->assertGuest();
    }
}
