<?php

namespace Tests\Modules\Tariffs;

use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// Pengaturan Klinik > Harga: GET /api/tariffs (search, category, editable_from) + inline edit through the versioned levels endpoint.
class TariffListTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private function item(string $code, string $q = '')
    {
        return collect($this->as(self::OWNER)->getJson('/api/tariffs?q='.urlencode($q ?: $code))->assertOk()->json('items'))->firstWhere('procedure_code', $code);
    }

    public function test_list_search_and_inline_edit_today_then_scheduled_fix_in_place(): void
    {
        $it = $this->item('23.2');
        $this->assertNotNull($it);
        $this->assertNotEmpty($it['levels']);
        $this->assertSame(now()->toDateString(), $it['editable_from']);
        $this->assertNotEmpty($this->as(self::OWNER)->getJson('/api/tariffs')->json('categories'));
        $levels = array_map(fn ($l) => ['code' => $l['variant'], 'label' => $l['label'], 'price_rp' => $l['price_rp'] + 5000], $it['levels']);
        $this->as(self::OWNER)->putJson("/api/tariffs/{$it['id']}/levels", ['valid_from' => $it['editable_from'], 'levels' => $levels])->assertOk();
        $price = Ctx::runAs($this->tenantA()->id, fn () => app(PriceLookup::class)->priceFor('23.2', $it['levels'][0]['variant'], CarbonImmutable::now()));
        $this->assertSame($it['levels'][0]['price_rp'] + 5000, $price); // billed from today

        $again = $this->item('23.2');
        $this->assertSame(now()->addDay()->toDateString(), $again['editable_from']); // one version per day
        $levels[0]['price_rp'] = 1000;
        $this->as(self::OWNER)->putJson("/api/tariffs/{$again['id']}/levels", ['valid_from' => $again['editable_from'], 'levels' => $levels])->assertOk();
        $levels[0]['price_rp'] = 2000; // a scheduled version is corrected in place, not pushed another day
        $this->as(self::OWNER)->putJson("/api/tariffs/{$again['id']}/levels", ['valid_from' => $again['editable_from'], 'levels' => $levels])->assertOk();
        $last = $this->item('23.2');
        $this->assertSame(2000, $last['next']['levels'][0]['price_rp']);
        $this->assertSame(now()->addDay()->toDateString(), $last['next']['valid_from']);
        $this->assertTrue(Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('action', 'tarif_diubah')->count() >= 3));
    }

    public function test_owner_only_and_tenant_scoped(): void
    {
        foreach (['dokter@senyum.test', 'kasir@senyum.test', 'depan@senyum.test'] as $who) {
            $this->as($who)->getJson('/api/tariffs')->assertForbidden();
        }
        $mine = $this->item('23.2');
        $this->as('dokter@ceria.test')->putJson("/api/tariffs/{$mine['id']}/levels", ['valid_from' => now()->toDateString(),
            'levels' => [['code' => 'standar', 'label' => 'x', 'price_rp' => 1]]])->assertNotFound();
    }
}
