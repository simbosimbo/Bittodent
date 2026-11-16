<?php

namespace Tests\Modules\Audit;

use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Unit 6 (DEVIATIONS #52): owner reads the append-only audit log; no route mutates it and the DB refuses it.
class AuditLogTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    public function test_owner_lists_newest_first_with_filters_and_listing_is_audited(): void
    {
        $a = $this->tenantA()->id;
        $this->as(self::OWNER)->getJson('/api/reports/integrity')->assertOk();
        $owner = $this->user(self::OWNER)->id;

        $res = $this->as(self::OWNER)->getJson('/api/audit-events')->assertOk()->assertJsonPath('per_page', 50);
        $rows = $res->json('data');
        $this->assertSame(['laporan_dibuka', 'laporan_integritas', 'Pemilik Senyum (dummy)'], [$rows[0]['action'], $rows[0]['entity_type'], $rows[0]['actor_name']]);
        $times = array_column($rows, 'occurred_at');
        $sorted = $times;
        rsort($sorted);
        $this->assertSame($sorted, $times);

        $only = $this->as(self::OWNER)->getJson("/api/audit-events?action=laporan_dibuka&entity_type=laporan_integritas&actor_id=$owner&from=".now('Asia/Jakarta')->toDateString())
            ->assertOk()->json('data');
        $this->assertNotEmpty($only);
        $this->assertSame(['laporan_dibuka'], array_values(array_unique(array_column($only, 'action'))));
        $this->assertSame([], $this->as(self::OWNER)->getJson('/api/audit-events?action=laporan_dibuka&to=2020-01-01')->assertOk()->json('data'));
        $this->assertTrue(Ctx::runAs($a, fn () => AuditEvent::where('action', 'audit_dibuka')->exists()));

        // tenant B sees none of tenant A's rows
        $b = $this->as('dokter@ceria.test')->getJson('/api/audit-events?per_page=1000')->assertOk()->json('data');
        $this->assertNotContains($owner, array_column($b, 'actor_id'));
    }

    public function test_non_owner_forbidden_and_no_mutation_route(): void
    {
        foreach (['dokter@senyum.test', 'depan@senyum.test', 'kasir@senyum.test', 'asisten@senyum.test'] as $who) {
            $this->as($who)->getJson('/api/audit-events')->assertForbidden();
        }
        $id = Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::value('id'));
        foreach (['patchJson', 'putJson', 'deleteJson'] as $m) {
            $this->assertContains($this->as(self::OWNER)->$m("/api/audit-events/$id", ['action' => 'x'])->status(), [404, 405]);
        }
        // ehr_app (the app's DB user) cannot change a row either
        $this->assertThrows(fn () => DB::update('UPDATE audit_event SET action = ? WHERE id = ?', ['x', $id]), QueryException::class);
        $this->assertThrows(fn () => DB::delete('DELETE FROM audit_event WHERE id = ?', [$id]), QueryException::class);
    }
}
