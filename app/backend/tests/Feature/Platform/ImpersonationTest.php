<?php

namespace Tests\Feature\Platform;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Shared\Audit\AuditEvent;
use App\Shared\Audit\AuthEvent;
use App\Shared\Audit\PlatformAuditLog;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

// DEVIATIONS #61: platform superadmin impersonates a clinic owner. Synthetic admin built here (no seeded secret).
class ImpersonationTest extends TestCase
{
    private const SPA = ['Origin' => 'http://127.0.0.1:5173', 'Referer' => 'http://127.0.0.1:5173/', 'Accept' => 'application/json'];

    private const PASSWORD = 'uji-platform-123';

    private function admin(array $permissions = [PlatformAdmin::IMPERSONATE]): PlatformAdmin
    {
        return PlatformAdmin::create(['name' => 'Admin Platform Uji', 'email' => 'admin'.Str::random(6).'@platform.test',
            'password' => self::PASSWORD, 'totp_secret' => DatabaseSeeder::TOTP_SECRET, 'permissions' => $permissions]);
    }

    /** Clinic user on the web guard explicitly (after a platform request the test app's default guard is `platform`). */
    private function clinic(string $email): static
    {
        return $this->actingAs($this->user($email), 'web')->withHeaders(self::SPA);
    }

    private function spa(): static
    {
        return $this->withHeaders(self::SPA);
    }

    private function login(PlatformAdmin $a): void
    {
        $this->spa()->postJson('/api/platform/login', ['email' => $a->email, 'password' => self::PASSWORD,
            'code' => app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET)])->assertOk()->assertJsonPath('id', $a->id);
    }

    /** Logs a fresh admin in and impersonates $email (an owner) in its first tenant. */
    private function impersonate(string $email = 'pemilik@senyum.test', ?string $tenantId = null): PlatformAdmin
    {
        $a = $this->admin();
        $this->login($a);
        $this->spa()->postJson('/api/platform/impersonate', ['tenant_id' => $tenantId ?? $this->tenantA()->id,
            'user_id' => $this->user($email)->id])->assertCreated();

        return $a;
    }

    private function tenantAuditCount(string $tenantId): int
    {
        return Ctx::runAs($tenantId, fn () => AuditEvent::count());
    }

    public function test_platform_login_needs_password_and_totp_and_is_a_separate_guard(): void
    {
        $a = $this->admin();
        $this->spa()->getJson('/api/platform/me')->assertUnauthorized();
        $this->spa()->postJson('/api/platform/login', ['email' => $a->email, 'password' => self::PASSWORD])->assertUnprocessable();
        $this->spa()->postJson('/api/platform/login', ['email' => $a->email, 'password' => self::PASSWORD, 'code' => '000000'])
            ->assertUnprocessable()->assertJsonPath('error', 'invalid_credentials');
        $this->spa()->postJson('/api/platform/login', ['email' => $a->email, 'password' => 'salah', 'code' => '000000'])->assertUnprocessable();
        $this->assertTrue(PlatformAuditLog::where('action', 'platform.login_gagal')->where('subject_id', $a->id)->exists());

        $this->login($a);
        $this->spa()->getJson('/api/platform/me')->assertOk()->assertJsonPath('impersonation', ['active' => false]);
        // platform admin without impersonation has no tenant context: fail closed
        $this->spa()->getJson('/api/patients')->assertUnauthorized();
        $this->spa()->getJson('/api/me')->assertUnauthorized();
        $this->assertFalse(AuthEvent::where('user_id', $a->id)->exists()); // platform logins never go to the clinic auth log
    }

    public function test_tenant_user_cannot_use_platform_endpoints(): void
    {
        $owner = $this->user('pemilik@senyum.test');
        $this->as('pemilik@senyum.test')->getJson('/api/platform/me')->assertUnauthorized();
        $this->as('pemilik@senyum.test')->getJson('/api/platform/tenants')->assertUnauthorized();
        $this->as('pemilik@senyum.test')->postJson('/api/platform/impersonate', ['tenant_id' => $this->tenantA()->id, 'user_id' => $owner->id])
            ->assertUnauthorized();
    }

    public function test_permission_platform_impersonate_is_required(): void
    {
        $this->login($this->admin([]));
        $this->spa()->getJson('/api/platform/tenants')->assertForbidden();
        $this->spa()->postJson('/api/platform/impersonate', ['tenant_id' => $this->tenantA()->id,
            'user_id' => $this->user('pemilik@senyum.test')->id])->assertForbidden();
        $this->spa()->getJson('/api/me')->assertUnauthorized();
    }

    public function test_tenant_list_shows_owner_admins_only(): void
    {
        $this->login($this->admin());
        $tenants = collect($this->spa()->getJson('/api/platform/tenants')->assertOk()->json('tenants'))->keyBy('name');
        $this->assertSame([$this->user('pemilik@senyum.test')->id], array_column($tenants['Klinik Gigi Senyum Sehat']['admins'], 'id'));
        $this->assertSame(['id', 'name'], array_keys($tenants['Klinik Gigi Ceria']['admins'][0]));
    }

    public function test_only_owner_of_that_tenant_can_be_targeted(): void
    {
        $this->login($this->admin());
        $a = $this->tenantA()->id;
        foreach (['dokter@senyum.test', 'depan@senyum.test', 'kasir@senyum.test', 'dokter@ceria.test'] as $email) {
            $this->spa()->postJson('/api/platform/impersonate', ['tenant_id' => $a, 'user_id' => $this->user($email)->id])
                ->assertUnprocessable()->assertJsonPath('error', 'invalid_target');
        }
        $this->spa()->postJson('/api/platform/impersonate', ['tenant_id' => (string) Str::uuid(),
            'user_id' => $this->user('pemilik@senyum.test')->id])->assertUnprocessable();
        $this->assertFalse(PlatformAuditLog::where('action', 'impersonation.start')->exists());
    }

    public function test_impersonation_keeps_tenant_isolation_and_shows_me_payload(): void
    {
        $admin = $this->impersonate();
        $me = $this->spa()->getJson('/api/me')->assertOk(); // no TOTP asked of the clinic user: the platform admin passed their own
        $me->assertJsonPath('user.email', 'pemilik@senyum.test')->assertJsonPath('active.tenant_name', 'Klinik Gigi Senyum Sehat')
            ->assertJsonPath('impersonation.active', true)->assertJsonPath('impersonation.platform_admin_name', $admin->name)
            ->assertJsonPath('memberships.0.tenant_id', $this->tenantA()->id);
        $this->assertContains('selesai', $me->json('impersonation.blocked_actions'));
        $this->assertNotNull($me->json('impersonation.started_at'));

        $other = $this->patientOf($this->tenantB());
        $this->spa()->getJson("/api/patients/{$other->id}")->assertNotFound();
        $mine = $this->patientOf($this->tenantA());
        $this->spa()->getJson("/api/patients/{$mine->id}")->assertOk();
        // cannot hop to another clinic via the branch switch
        $this->spa()->postJson('/api/session/branch', ['tenant_id' => $this->tenantB()->id, 'branch_id' => (string) Str::uuid()])->assertNotFound();
        $this->spa()->getJson('/api/platform/me')->assertOk()->assertJsonPath('impersonation.active', true)
            ->assertJsonPath('impersonation.tenant_id', $this->tenantA()->id);

        $read = PlatformAuditLog::where('action', 'platform.patient_read')->where('subject_id', $mine->id)->firstOrFail();
        $this->assertSame([$admin->id, $this->user('pemilik@senyum.test')->id, $this->tenantA()->id, 'GET'],
            [$read->platform_admin_id, $read->on_behalf_of_user_id, $read->target_tenant_id, $read->method]);
        $this->assertNotNull($read->request_id);
    }

    public function test_writes_during_impersonation_go_to_platform_log_not_tenant_audit(): void
    {
        $a = $this->tenantA()->id;
        $before = $this->tenantAuditCount($a);
        $authBefore = AuthEvent::count();
        $admin = $this->impersonate();
        $this->spa()->putJson('/api/settings/clinic', ['correction_window_hours' => 72])->assertOk();
        $this->spa()->getJson('/api/patients/'.Str::uuid())->assertNotFound();

        $this->assertSame($before, $this->tenantAuditCount($a));
        $this->assertSame($authBefore, AuthEvent::count()); // the clinic user's "login" is not in the clinic auth log either
        $row = PlatformAuditLog::where('action', 'ubah_pengaturan')->firstOrFail();
        $this->assertSame([$admin->id, $this->user('pemilik@senyum.test')->id, $a, 'tenant', $a, 'PUT', 'api/settings/clinic'],
            [$row->platform_admin_id, $row->on_behalf_of_user_id, $row->target_tenant_id, $row->subject_type, $row->subject_id,
                $row->method, $row->path]);
        $this->assertSame('correction_window_hours', $row->detail['field']);
        $this->assertTrue(PlatformAuditLog::where('action', 'impersonation.start')->where('platform_admin_id', $admin->id)->exists());
        $this->assertTrue(PlatformAuditLog::where('action', 'auth.login')->exists());
    }

    /** Every blocked action answers 403 even for an owner who is also a dentist (dokter@ceria.test owns Klinik Gigi Ceria). */
    public function test_signature_correction_and_account_security_actions_are_blocked(): void
    {
        $this->impersonate('dokter@ceria.test', $this->tenantB()->id);
        $id = (string) Str::uuid();
        foreach ([
            ['POST', "/api/visits/$id/selesai"], ['POST', "/api/visits/$id/approve-drafts"], ['POST', "/api/notes/$id/corrections"],
            ['POST', "/api/procedures/$id/corrections"], ['POST', "/api/procedures/$id/replace"], ['POST', "/api/procedures/$id/status"],
            ['POST', "/api/procedure-corrections/$id/approve"], ['POST', "/api/procedure-corrections/$id/reject"],
            ['POST', "/api/correction-requests/$id/approve"], ['PUT', '/api/me/selesai-pin'],
            ['POST', '/user/two-factor-authentication'], ['DELETE', '/user/two-factor-authentication'], ['POST', '/user/confirm-password'],
            ['POST', '/user/confirmed-two-factor-authentication'], ['POST', '/user/two-factor-recovery-codes'],
        ] as [$method, $uri]) {
            $this->spa()->json($method, $uri, ['pin' => '123456'])->assertForbidden()->assertJsonPath('error', 'impersonation_blocked');
        }
        $this->assertSame(15, PlatformAuditLog::where('action', 'platform.blocked')->count());

        // the real user (no impersonation) still can
        $this->spa()->postJson('/api/platform/impersonate/stop')->assertOk();
        $this->clinic('dokter@ceria.test')->putJson('/api/me/selesai-pin', ['pin' => '123456'])->assertOk();
    }

    public function test_every_sign_and_correction_decision_route_is_guarded(): void
    {
        $guarded = 0;
        foreach (Route::getRoutes() as $r) {
            $mw = $r->gatherMiddleware();
            $writes = array_diff($r->methods(), ['GET', 'HEAD']) !== [];
            if ($writes && (array_intersect($mw, ['perm:note.sign', 'perm:correction.approve']) || $r->uri() === 'api/me/selesai-pin')) {
                $this->assertContains('not_impersonating', $mw, $r->uri());
                $guarded++;
            }
        }
        $this->assertGreaterThanOrEqual(10, $guarded);
    }

    public function test_stop_restores_platform_session_and_normal_audit(): void
    {
        $a = $this->tenantA()->id;
        $sid = fn () => $this->app['session.store']->getId();
        $this->login($this->admin());
        $s0 = $sid();
        $this->spa()->postJson('/api/platform/impersonate', ['tenant_id' => $a, 'user_id' => $this->user('pemilik@senyum.test')->id])->assertCreated();
        $s1 = $sid();
        $this->spa()->postJson('/api/platform/impersonate/stop')->assertOk()->assertJsonPath('impersonation', ['active' => false]);
        $this->assertCount(3, array_unique([$s0, $s1, $sid()])); // new session id on start and on stop (fixation)
        $this->spa()->getJson('/api/me')->assertUnauthorized();
        $this->spa()->getJson('/api/patients')->assertUnauthorized();
        $this->spa()->getJson('/api/platform/me')->assertOk()->assertJsonPath('impersonation', ['active' => false]);
        $this->assertTrue(PlatformAuditLog::where('action', 'impersonation.stop')->exists());
        $this->assertSame(1, DB::table('platform_impersonation')->whereNotNull('ended_at')->count());

        // a real clinic user afterwards is audited in the clinic log as before
        $before = $this->tenantAuditCount($a);
        $this->clinic('pemilik@senyum.test')->putJson('/api/settings/clinic', ['correction_window_hours' => 96])->assertOk()
            ->assertJsonMissingPath('impersonation');
        $this->assertSame($before + 1, $this->tenantAuditCount($a));
        $this->clinic('pemilik@senyum.test')->getJson('/api/me')->assertOk()->assertJsonPath('impersonation', ['active' => false]);
    }

    public function test_losing_the_permission_ends_the_impersonation(): void
    {
        $admin = $this->impersonate();
        $this->spa()->getJson('/api/me')->assertOk();
        $admin->update(['permissions' => []]);
        $this->spa()->getJson('/api/me')->assertUnauthorized();
        $this->assertTrue(PlatformAuditLog::where('action', 'impersonation.stop')->where('detail->reason', 'sesi_tidak_valid')->exists());
    }

    public function test_platform_logout_ends_impersonation(): void
    {
        $this->impersonate();
        $this->spa()->postJson('/api/platform/logout')->assertNoContent();
        $this->spa()->getJson('/api/me')->assertUnauthorized();
        $this->spa()->getJson('/api/platform/me')->assertUnauthorized();
    }

    public function test_platform_tables_are_append_only_or_end_once(): void
    {
        $admin = DB::connection('mysql_admin'); // full privileges: proves the TRIGGER refuses, not just the grants
        $id = (string) Str::uuid();
        $admin->insert('INSERT INTO platform_audit_log (id, action) VALUES (?, ?)', [$id, 'uji']);
        foreach (['UPDATE platform_audit_log SET action = ? WHERE id = ?' => ['x', $id], 'DELETE FROM platform_audit_log WHERE id = ?' => [$id]] as $sql => $b) {
            try {
                $admin->affectingStatement($sql, $b);
                $this->fail("Not rejected: $sql");
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }
        }
        $this->expectException(QueryException::class);
        DB::connection('mysql')->delete('DELETE FROM platform_audit_log WHERE id = ?', [$id]); // and ehr_app has no DELETE grant
    }
}
