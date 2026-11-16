<?php

namespace Tests\Modules\Tariffs;

use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Permissions\Permissions;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

// D-045 / T1: the dentist sees (never sets) today's prices on the visit screen. GET /api/tariffs/price-list, perm price.view.
class PriceListTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private const DOC = 'dokter@senyum.test';

    private function list(string $as): array
    {
        return collect($this->as($as)->getJson('/api/tariffs/price-list')->assertOk()->json('items'))->keyBy('procedure_code')->all();
    }

    public function test_dokter_melihat_harga_band_miliknya(): void
    {
        $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'dentist',
            'dentist_id' => $this->user(self::DOC)->id, 'price_rp' => 500000, 'valid_from' => now()->toDateString()])->assertOk();

        $mine = $this->list(self::DOC)['23.2'];
        $this->assertNotEmpty($mine['name']);
        $this->assertSame(['variant' => 'standar', 'label' => $mine['levels'][0]['label'], 'price_rp' => 500000], $mine['levels'][0]);
        $this->assertSame(250000, $this->list('dokter.bunga@senyum.test')['23.2']['levels'][0]['price_rp']); // override is per dentist
    }

    public function test_kode_tanpa_harga_tidak_muncul(): void
    {
        Ctx::runAs($this->tenantA()->id, fn () => Tariff::create(['procedure_code' => '96.59', 'name' => 'Belum berlaku', 'variant' => 'standar',
            'level_label' => 'Standar', 'level_rank' => 1, 'price_rp' => 1000, 'valid_from' => now()->addDay()->toDateString()]));
        $items = $this->list(self::DOC);
        $this->assertArrayNotHasKey('96.59', $items); // only a future version: no price today
        $this->assertArrayNotHasKey('99.99', $items); // never priced
        foreach ($items as $it) {
            $this->assertNotEmpty($it['levels']);
        }
    }

    public function test_asisten_dan_tanpa_izin_403(): void
    {
        foreach (['asisten@senyum.test', 'kasir@senyum.test', 'depan@senyum.test', self::OWNER] as $who) {
            $this->as($who)->getJson('/api/tariffs/price-list')->assertForbidden();
        }
    }

    public function test_tenant_lain_tidak_terlihat(): void
    {
        $this->as(self::OWNER)->postJson('/api/tariffs', ['procedure_code' => '96.58', 'name' => 'Hanya Senyum', 'price_rp' => 77000])->assertCreated();
        $this->assertSame(77000, $this->list(self::DOC)['96.58']['levels'][0]['price_rp']);
        $this->assertArrayNotHasKey('96.58', $this->list('dokter@ceria.test'));
    }

    public function test_tidak_ada_rute_dokter_mengubah_harga(): void
    {
        foreach (Route::getRoutes() as $r) {
            if (! str_contains($r->uri(), 'tariff') || $r->methods() === ['GET', 'HEAD']) {
                continue;
            }
            $perms = array_map(fn ($m) => substr($m, 5), array_filter($r->gatherMiddleware(), fn ($m) => is_string($m) && str_starts_with($m, 'perm:')));
            $this->assertNotEmpty($perms, $r->uri());
            foreach ($perms as $p) {
                $this->assertFalse(Permissions::allows(['dentist'], $p), "{$r->uri()} is writable by a dentist ($p)");
            }
        }
    }
}
