<?php

namespace Tests\Modules\Identity;

use App\Shared\Audit\AuthEvent;
use Database\Seeders\DatabaseSeeder;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class AuthTest extends TestCase
{
    private const SPA = ['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/', 'Accept' => 'application/json'];

    public function test_user_without_2fa_gets_403_two_factor_required_but_may_enroll(): void
    {
        $u = DatabaseSeeder::user('baru@senyum.test', 'Pengguna Baru', 'lainnya', twoFactor: false);
        $this->actingAs($u)->getJson('/api/me')->assertForbidden()->assertJson(['error' => 'two_factor_required']);
        $this->actingAs($u)->getJson('/api/patients')->assertForbidden()->assertJson(['error' => 'two_factor_required']);
        // enrollment endpoint is reachable (asks for password confirmation first, not two_factor_required)
        $res = $this->actingAs($u)->withHeaders(self::SPA)->postJson('/user/two-factor-authentication');
        $this->assertNotSame('two_factor_required', $res->json('error'));
        $this->assertContains($res->status(), [200, 423]);
    }

    public function test_login_with_totp_then_me(): void
    {
        $u = $this->user('dokter@senyum.test');
        $this->withHeaders(self::SPA)->postJson('/login', ['email' => $u->email, 'password' => DatabaseSeeder::PASSWORD])
            ->assertOk()->assertJson(['two_factor' => true]);
        $this->assertGuest();
        $code = app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET);
        $this->withHeaders(self::SPA)->postJson('/two-factor-challenge', ['code' => $code])->assertNoContent();
        $this->assertAuthenticatedAs($u);
        $this->withHeaders(self::SPA)->getJson('/api/me')->assertOk()
            ->assertJsonPath('active.tenant_name', 'Klinik Gigi Senyum Sehat')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertTrue(AuthEvent::where('user_id', $u->id)->where('action', 'login')->exists());
    }

    public function test_wrong_totp_rejected_and_audited(): void
    {
        $u = $this->user('dokter@senyum.test');
        $this->withHeaders(self::SPA)->postJson('/login', ['email' => $u->email, 'password' => DatabaseSeeder::PASSWORD])->assertOk();
        $this->withHeaders(self::SPA)->postJson('/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
        $this->assertGuest();
        $this->assertTrue(AuthEvent::where('user_id', $u->id)->where('action', '2fa_gagal')->exists());
    }

    public function test_wrong_password_audited_without_plain_email(): void
    {
        $this->withHeaders(self::SPA)->postJson('/login', ['email' => 'dokter@senyum.test', 'password' => 'salah'])->assertUnprocessable();
        $e = AuthEvent::where('action', 'login_gagal')->latest('occurred_at')->firstOrFail();
        $this->assertSame(64, strlen($e->email_hash));
    }
}
