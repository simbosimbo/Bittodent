<?php

namespace Tests\Modules\Tariffs;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Tariffs\Contracts\PriceContext;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Domain\Derivation;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tariffs\Models\TariffRule;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use RuntimeException;
use Tests\TestCase;

// Unit B: optional derivation rules (default OFF, explicit cell always wins) + bulk %/Rp helper. Preview before apply.
class TariffRulesTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private const DOC = 'dokter@senyum.test';

    private const SP30 = ['band' => 'specialist', 'enabled' => true, 'kind' => 'percent', 'value' => 30, 'rounding' => 'nearest_1000'];

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function rule(array $body, bool $dry = false, string $as = self::OWNER)
    {
        return $this->as($as)->putJson('/api/tariffs/rules', $body + ['dry_run' => $dry]);
    }

    private function bulk(array $body, bool $dry = false, string $as = self::OWNER)
    {
        return $this->as($as)->postJson('/api/tariffs/bulk', $body + ['dry_run' => $dry, 'valid_from' => now()->toDateString()]);
    }

    private function quote(string $category, ?string $field = null, string $code = '23.2', string $variant = 'standar', ?CarbonImmutable $on = null): array
    {
        return $this->inA(fn () => app(PriceLookup::class)->quote($code, $variant, $on ?? CarbonImmutable::now(),
            new PriceContext($this->user(self::DOC)->id, $category, $field)));
    }

    private function price(string $category, ?string $field = null, string $code = '23.2', string $variant = 'standar'): int
    {
        return $this->quote($category, $field, $code, $variant)['price_rp'];
    }

    private function row(array $rows, string $code, string $variant = 'standar'): array
    {
        return collect($rows)->first(fn ($r) => $r['procedure_code'] === $code && $r['variant'] === $variant);
    }

    public function test_no_rules_means_unit_a_prices(): void
    {
        $this->inA(fn () => $this->assertSame(0, TariffRule::count()));
        $this->as(self::OWNER)->getJson('/api/tariffs/rules')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame([250000, 250000, 250000], [$this->price('general'), $this->price('specialist'), $this->price('specialist', 'sp_ort')]);
        $this->assertSame(['umum', false], [$this->quote('specialist')['band'], $this->quote('specialist')['derived']]);
    }

    public function test_specialist_rule_preview_apply_audit_disable(): void
    {
        $preview = $this->rule(self::SP30, true)->assertOk()->assertJsonPath('dry_run', true)->json();
        $this->assertSame(10, $preview['affected']); // every Umum row of the template
        $this->assertSame([250000, 325000, 'rule'], array_values(array_intersect_key($this->row($preview['rows'], '23.2'),
            array_flip(['before_rp', 'after_rp', 'source']))));
        $this->inA(fn () => $this->assertSame(0, TariffRule::count()));
        $this->assertSame(250000, $this->price('specialist'));

        $this->rule(self::SP30)->assertOk()->assertJsonPath('dry_run', false)->assertJsonPath('affected', 10);
        $this->assertSame([325000, 250000, 455000], [$this->price('specialist'), $this->price('general'), $this->price('specialist', null, '23.2', 'p2')]);
        $this->assertSame(['specialist', true], [$this->quote('specialist')['band'], $this->quote('specialist')['derived']]);
        $this->assertSame(250000, $this->inA(fn () => app(PriceLookup::class)->priceFor('23.2', 'standar', CarbonImmutable::now())));
        $detail = $this->inA(fn () => AuditEvent::where('action', 'tarif_aturan_diubah')->sole()->detail);
        $this->assertSame([null, 30, 10, 'specialist'], [$detail['old'], $detail['new']['value'], $detail['affected'], $detail['band']]);

        $off = $this->rule(['band' => 'specialist', 'enabled' => false])->assertOk()->json();
        $this->assertSame([10, 'fallback', 250000], [$off['affected'], $this->row($off['rows'], '23.2')['source'], $this->price('specialist')]);
        $this->inA(fn () => $this->assertSame([1, false], [TariffRule::count(), TariffRule::sole()->enabled])); // kept, not deleted
        $this->inA(fn () => $this->assertSame(2, AuditEvent::where('action', 'tarif_aturan_diubah')->count()));
    }

    public function test_explicit_specialist_cell_wins_over_rule(): void
    {
        $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'specialist',
            'price_rp' => 300000, 'valid_from' => now()->toDateString()])->assertOk();
        $rows = $this->rule(self::SP30)->assertOk()->assertJsonPath('affected', 9)->json('rows');
        $this->assertSame(['cell', 300000], [$this->row($rows, '23.2')['source'], $this->row($rows, '23.2')['after_rp']]);
        $this->assertSame([300000, false, 455000], [$this->price('specialist'), $this->quote('specialist')['derived'], $this->price('specialist', null, '23.2', 'p2')]);
    }

    public function test_field_rule_builds_on_resolved_specialist_price(): void
    {
        $this->rule(self::SP30)->assertOk();
        $fieldRule = ['band' => 'field', 'field' => 'sp_ort', 'enabled' => true, 'kind' => 'amount', 'value' => 50000, 'rounding' => 'none'];
        $this->assertSame(375000, $this->row($this->rule($fieldRule, true)->assertOk()->json('rows'), '23.2')['after_rp']);
        $this->rule($fieldRule)->assertOk();
        $this->assertSame([375000, 325000, 250000], [$this->price('specialist', 'sp_ort'), $this->price('specialist', 'sp_kg'), $this->price('general', 'sp_ort')]);
        $this->assertSame(['field', true], [$this->quote('specialist', 'sp_ort')['band'], $this->quote('specialist', 'sp_ort')['derived']]);

        // explicit Spesialis cell becomes the field rule's base; explicit field cell beats the field rule
        $put = fn ($band, $price, $extra = []) => $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar',
            'band' => $band, 'price_rp' => $price, 'valid_from' => now()->toDateString()] + $extra)->assertOk();
        $put('specialist', 300000);
        $this->assertSame(350000, $this->price('specialist', 'sp_ort'));
        $put('field', 333000, ['field' => 'sp_ort']);
        $this->assertSame([333000, false], [$this->price('specialist', 'sp_ort'), $this->quote('specialist', 'sp_ort')['derived']]);
    }

    public function test_category_and_procedure_scope_most_specific_wins(): void
    {
        $this->rule(['band' => 'specialist', 'category' => 'scaling', 'enabled' => true, 'kind' => 'percent', 'value' => 10, 'rounding' => 'none'])
            ->assertOk()->assertJsonPath('affected', 3);
        $this->assertSame([220000, 250000], [$this->price('specialist', null, '96.54'), $this->price('specialist')]);

        $this->rule(self::SP30)->assertOk()->assertJsonPath('affected', 7); // the 3 scaling rows keep their more specific rule
        $this->assertSame([220000, 325000], [$this->price('specialist', null, '96.54'), $this->price('specialist')]);

        $this->rule(['band' => 'specialist', 'procedure_code' => '96.54', 'variant' => 'berat', 'enabled' => true, 'kind' => 'amount', 'value' => 0, 'rounding' => 'none'])
            ->assertOk()->assertJsonPath('affected', 1);
        $this->assertSame([400000, 220000], [$this->price('specialist', null, '96.54', 'berat'), $this->price('specialist', null, '96.54')]);

        // owner regroups 23.2 into 'scaling' (audited) -> the category rule now applies to it
        $this->as(self::OWNER)->putJson('/api/tariffs/category', ['procedure_code' => '23.2', 'category' => 'scaling'])->assertOk();
        $this->assertSame(275000, $this->price('specialist'));
        $this->inA(fn () => $this->assertSame(['tambalan', 'scaling'], array_values(array_intersect_key(
            AuditEvent::where('action', 'tarif_kategori_diubah')->sole()->detail, array_flip(['old', 'category'])))));
    }

    public function test_rounding_modes_and_halfway_cases(): void
    {
        $this->assertSame(326000, Derivation::apply(250000, 'amount', 75500, 'nearest_1000')); // exactly half -> up
        $this->assertSame(325000, Derivation::apply(250000, 'amount', 75499, 'nearest_1000'));
        $this->assertSame(250500, Derivation::apply(250000, 'amount', 250, 'nearest_500'));
        $this->assertSame(100, Derivation::apply(0, 'amount', 50, 'nearest_100'));
        $this->assertSame(500, Derivation::apply(333, 'percent', 50, 'none')); // 499.5 -> 500
        $this->assertSame(326000, Derivation::apply(325001, 'amount', 0, 'ceil_1000'));
        $this->assertSame(325000, Derivation::apply(325999, 'amount', 0, 'floor_1000'));
        $this->assertSame(0, Derivation::apply(250000, 'percent', -100, 'none'));
        $this->assertSame(0, Derivation::apply(100, 'amount', -500, 'none')); // lookup clamp

        $this->rule(['band' => 'specialist', 'enabled' => true, 'kind' => 'amount', 'value' => 75500, 'rounding' => 'nearest_1000'])->assertOk();
        $this->assertSame(326000, $this->price('specialist'));
    }

    public function test_negative_rejected_and_missing_umum_still_throws(): void
    {
        $this->rule(['band' => 'specialist', 'enabled' => true, 'kind' => 'amount', 'value' => -200000, 'rounding' => 'none'], true)
            ->assertUnprocessable()->assertJsonPath('error', 'negative_result'); // 23.01 Umum 100000 would go below 0
        $this->rule(['band' => 'specialist', 'category' => 'scaling', 'enabled' => true, 'kind' => 'amount', 'value' => -150000, 'rounding' => 'none'])->assertOk();
        $this->assertSame(50000, $this->price('specialist', null, '96.54'));

        $this->rule(self::SP30)->assertOk();
        $this->expectException(RuntimeException::class);
        $this->price('specialist', null, '23.2', 'p9');
    }

    public function test_validation(): void
    {
        $bad = [
            ['band' => 'field'] + self::SP30,                                         // field required
            ['field' => 'sp_ort'] + self::SP30,                                       // field only for band field
            ['band' => 'dentist'] + self::SP30,                                       // overrides are never derived
            ['rounding' => 'nearest_7'] + self::SP30,
            ['value' => 2000] + self::SP30,
            ['category' => 'Tambalan!'] + self::SP30,
            ['category' => 'scaling', 'procedure_code' => '96.54', 'variant' => 'berat'] + self::SP30,
            ['procedure_code' => '96.54'] + self::SP30,                               // variant required with code
            ['band' => 'specialist', 'enabled' => true, 'value' => 10, 'rounding' => 'none'], // kind required when enabling
        ];
        foreach ($bad as $body) {
            $this->rule($body, true)->assertUnprocessable();
        }
        $this->rule(['procedure_code' => '99.99', 'variant' => 'standar'] + self::SP30)->assertUnprocessable()->assertJsonPath('error', 'no_umum');
        $this->rule(['band' => 'specialist', 'enabled' => false])->assertNotFound();
        $this->bulk(['target' => 'field', 'kind' => 'percent', 'value' => 10, 'rounding' => 'none'])->assertUnprocessable();
        $this->bulk(['target' => 'dentist', 'kind' => 'percent', 'value' => 10, 'rounding' => 'none'])->assertUnprocessable();
        $this->inA(fn () => $this->assertSame(0, TariffRule::count()));
    }

    public function test_bulk_umum_preview_apply_versions_and_keeps_invoice_snapshots(): void
    {
        $old = $this->inA(fn () => ProcedureRecord::where('tooth', 18)->where('state', 'final')->firstOrFail());
        $new = $this->as(self::DOC)->postJson("/api/procedures/{$old->id}/status", ['to' => 'selesai'])->assertCreated()->json('id');
        $line = $this->inA(fn () => InvoiceLine::where('procedure_id', $new)->firstOrFail());
        $before = $this->inA(fn () => Tariff::count());

        $body = ['target' => 'umum', 'category' => 'pencabutan', 'kind' => 'percent', 'value' => 10, 'rounding' => 'nearest_1000'];
        $preview = $this->bulk($body, true)->assertOk()->assertJsonPath('count', 4)->json('rows');
        $this->assertSame([150000, 165000], [$this->row($preview, '23.09')['old_rp'], $this->row($preview, '23.09')['new_rp']]);
        $this->inA(fn () => $this->assertSame($before, Tariff::count()));

        $this->bulk($body)->assertOk()->assertJsonPath('count', 4);
        $this->inA(function () use ($before) {
            $this->assertSame($before + 4, Tariff::count());
            $this->assertSame(165000, app(PriceLookup::class)->priceFor('23.09', 'standar', CarbonImmutable::now()));
            $this->assertSame(250000, app(PriceLookup::class)->priceFor('23.2', 'standar', CarbonImmutable::now())); // out of scope
            $this->assertSame([['standar', 'Biasa', 1], ['sulit', 'Sulit', 2]], Tariff::where('procedure_code', '23.09')->whereNull('valid_to')
                ->orderBy('level_rank')->get()->map(fn ($t) => [$t->variant, $t->level_label, $t->level_rank])->all()); // level set kept
            $this->assertSame(['pencabutan', 4], [AuditEvent::where('action', 'tarif_massal_diubah')->sole()->detail['category'],
                AuditEvent::where('action', 'tarif_massal_diubah')->sole()->detail['count']]);
        });
        $this->assertSame(150000, $this->inA(fn () => $line->fresh()->price_rp)); // snapshot untouched

        $this->bulk($body)->assertConflict(); // one version per day, all-or-nothing
        $this->inA(fn () => $this->assertSame($before + 4, Tariff::count()));
    }

    public function test_bulk_cells_edits_only_existing_cells_never_invents_them(): void
    {
        $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'specialist',
            'price_rp' => 300000, 'valid_from' => now()->toDateString()])->assertOk();
        $this->rule(self::SP30)->assertOk();
        $body = ['target' => 'specialist', 'kind' => 'amount', 'value' => 20000, 'rounding' => 'none', 'valid_from' => now()->addDay()->toDateString()];
        $this->bulk($body, true)->assertOk()->assertJsonPath('count', 1)->assertJsonPath('rows.0.new_rp', 320000);
        $this->bulk($body)->assertOk();
        $this->inA(fn () => $this->assertSame(2, TariffRate::count())); // closed + new version of the one cell
        $this->assertSame(320000, $this->quote('specialist', null, '23.2', 'standar', CarbonImmutable::now()->addDay())['price_rp']);
        $this->assertSame(455000, $this->quote('specialist', null, '23.2', 'p2', CarbonImmutable::now()->addDay())['price_rp']); // still the rule
    }

    public function test_non_owner_forbidden(): void
    {
        foreach ([self::DOC, 'depan@senyum.test', 'asisten@senyum.test', 'kasir@senyum.test'] as $email) {
            $this->as($email)->getJson('/api/tariffs/rules')->assertForbidden();
            $this->rule(self::SP30, true, $email)->assertForbidden();
            $this->bulk(['target' => 'umum', 'kind' => 'percent', 'value' => 10, 'rounding' => 'none'], true, $email)->assertForbidden();
            $this->as($email)->putJson('/api/tariffs/category', ['procedure_code' => '23.2', 'category' => 'x'])->assertForbidden();
        }
    }

    public function test_tenant_isolation(): void
    {
        $this->rule(self::SP30)->assertOk();
        Ctx::runAs($this->tenantB()->id, function () {
            $this->assertSame(0, TariffRule::count());
            $this->assertSame(150000, app(PriceLookup::class)->priceFor('23.09', 'standar', CarbonImmutable::now(),
                new PriceContext($this->user('dokter@ceria.test')->id, 'specialist', null)));
        });
        $this->as('dokter@ceria.test')->getJson('/api/tariffs/rules')->assertOk()->assertJsonCount(0, 'data');
        $this->rule(['band' => 'specialist', 'enabled' => false], false, 'dokter@ceria.test')->assertNotFound();
        $this->assertSame(325000, $this->price('specialist'));
    }
}
