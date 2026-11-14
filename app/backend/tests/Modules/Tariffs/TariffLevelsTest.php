<?php

namespace Tests\Modules\Tariffs;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Domain\DifficultyTemplate;
use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use RuntimeException;
use Tests\TestCase;

class TariffLevelsTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function filling(): Tariff
    {
        return $this->inA(fn () => Tariff::where('procedure_code', '23.2')->whereNull('valid_to')->orderBy('level_rank')->firstOrFail());
    }

    private function body(string $from): array
    {
        return ['valid_from' => $from, 'levels' => [['code' => 'standar', 'label' => '1 permukaan', 'price_rp' => 275000],
            ['code' => 'p2', 'label' => '2-3 permukaan', 'price_rp' => 380000]]];
    }

    public function test_template_is_seeded_per_tenant(): void
    {
        foreach ([$this->tenantA(), $this->tenantB()] as $t) {
            $levels = Ctx::runAs($t->id, fn () => Tariff::whereNull('valid_to')->orderBy('procedure_code')->orderBy('level_rank')
                ->get()->groupBy('procedure_code')->map(fn ($g) => $g->pluck('variant')->all())->all());
            $expected = collect(DifficultyTemplate::LEVELS)->map(fn ($p) => array_column($p[1], 0))->sortKeys()->all();
            $this->assertSame($expected, $levels, $t->name);
        }
    }

    public function test_owner_edit_creates_new_version_and_keeps_old_snapshots(): void
    {
        $line = $this->inA(fn () => InvoiceLine::orderBy('created_at')->firstOrFail());
        $from = now()->addDay()->toDateString();
        $this->as(self::OWNER)->putJson("/api/tariffs/{$this->filling()->id}/levels", $this->body($from))->assertOk()
            ->assertJsonPath('levels.1.level_rank', 2)->assertJsonPath('levels.1.price_rp', 380000);
        // same or earlier date than the latest version => refused
        $this->as(self::OWNER)->putJson("/api/tariffs/{$this->filling()->id}/levels", $this->body($from))->assertConflict();

        $this->inA(function () use ($line, $from) {
            $prices = app(PriceLookup::class);
            $today = CarbonImmutable::now();
            $next = CarbonImmutable::parse($from);
            $this->assertSame([250000, 275000], [$prices->priceFor('23.2', 'standar', $today), $prices->priceFor('23.2', 'standar', $next)]);
            $this->assertSame(450000, $prices->priceFor('23.2', 'p3plus', $today)); // old version untouched
            $this->assertSame(250000, InvoiceLine::findOrFail($line->id)->price_rp); // invoice snapshot unchanged
            $this->assertTrue(AuditEvent::where('action', 'tarif_diubah')->exists());
            $this->expectException(RuntimeException::class); // dropped level no longer priced from the new version on
            $prices->priceFor('23.2', 'p3plus', $next);
        });
    }

    public function test_only_owner_edits_and_past_dates_are_refused(): void
    {
        $id = $this->filling()->id;
        foreach (['dokter@senyum.test', 'depan@senyum.test', 'asisten@senyum.test'] as $email) {
            $this->as($email)->putJson("/api/tariffs/$id/levels", $this->body(now()->addDay()->toDateString()))->assertForbidden();
        }
        $this->as(self::OWNER)->putJson("/api/tariffs/$id/levels", $this->body(now()->subDay()->toDateString()))->assertUnprocessable();
    }

    public function test_tenant_b_tariff_is_not_found(): void
    {
        $b = Ctx::runAs($this->tenantB()->id, fn () => Tariff::firstOrFail()->id);
        $this->as(self::OWNER)->putJson("/api/tariffs/$b/levels", $this->body(now()->addDay()->toDateString()))->assertNotFound();
        $this->as('dokter@ceria.test')->putJson("/api/tariffs/{$this->filling()->id}/levels", $this->body(now()->addDay()->toDateString()))->assertNotFound();
    }
}
