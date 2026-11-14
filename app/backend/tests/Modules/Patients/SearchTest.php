<?php

namespace Tests\Modules\Patients;

use App\Modules\Patients\Models\Patient;
use App\Modules\Patients\Services\PatientSearch;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SearchTest extends TestCase
{
    public function test_name_search_uses_patient_search_and_stays_in_tenant(): void
    {
        $a = $this->tenantA()->id;
        Ctx::runAs($this->tenantB()->id, fn () => (new Patient)->fillIdentity(['name' => 'Sari Tenant Lain'])->save());
        Ctx::runAs($a, fn () => (new Patient)->fillIdentity(['name' => 'Dewi Sari Uji'])->save());

        PatientSearch::$calls = 0;
        DB::connection('mysql')->enableQueryLog();
        $res = $this->as('dokter@senyum.test')->getJson('/api/patients?q=sari')->assertOk();
        $log = collect(DB::connection('mysql')->getQueryLog())->pluck('query')->implode("\n");

        $this->assertSame(1, PatientSearch::$calls);
        $this->assertStringContainsString('`name_normalized` like ?', $log);
        $names = collect($res->json('data'))->pluck('name');
        $this->assertNotEmpty($names);
        $this->assertTrue($names->every(fn ($n) => preg_match('/(^|\s)sari/i', $n) === 1), $names->implode(', '));
        $this->assertTrue($names->contains(fn ($n) => str_starts_with($n, 'Sari ')));
        $this->assertTrue($names->contains('Dewi Sari Uji'));
        $this->assertFalse($names->contains('Sari Tenant Lain'));
        $ids = collect($res->json('data'))->pluck('id');
        $this->assertSame($ids->count(), Ctx::runAs($a, fn () => Patient::whereIn('id', $ids)->count()));
    }

    public function test_exact_nik_and_phone_via_blind_index(): void
    {
        $r = $this->as('dokter@senyum.test');
        $this->assertCount(1, $r->getJson('/api/patients?q=9901000000000001')->assertOk()->json('data'));
        $this->assertCount(1, $r->getJson('/api/patients?q=0899-01-000001')->assertOk()->json('data'));
        // tenant B's NIK is invisible from tenant A
        $this->assertCount(0, $r->getJson('/api/patients?q=9902000000000001')->assertOk()->json('data'));
    }

    public function test_keyset_pagination_walks_all_rows_once(): void
    {
        $r = $this->as('dokter@senyum.test');
        $seen = [];
        $cursor = null;
        do {
            $page = $r->getJson('/api/patients'.($cursor ? '?cursor='.$cursor : ''))->assertOk();
            $seen = [...$seen, ...collect($page->json('data'))->pluck('id')->all()];
            $cursor = $page->json('next_cursor');
        } while ($cursor);
        $this->assertCount(42, $seen); // 40 + minor (C3) + online booking patient
        $this->assertCount(42, array_unique($seen));
    }
}
