<?php

namespace Tests\Modules\Tariffs;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Tariffs\Contracts\PriceContext;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Models\TariffRate;
use App\Modules\Tenancy\Models\DentistProfile;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use RuntimeException;
use Tests\TestCase;

// Unit A tarif bertingkat: Umum (tariff) + explicit Spesialis / bidang / per-dokter cells (tariff_rate), dentist_profile per tenant.
class TariffBandsTest extends TestCase
{
    private const OWNER = 'pemilik@senyum.test';

    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function rate(string $band, ?int $price, array $extra = [], string $code = '23.2', string $as = self::OWNER)
    {
        return $this->as($as)->putJson('/api/tariffs/rates', ['procedure_code' => $code, 'variant' => 'standar', 'band' => $band,
            'price_rp' => $price, 'valid_from' => now()->toDateString()] + $extra);
    }

    private function price(string $category, ?string $field = null, ?string $dentist = null): int
    {
        return $this->inA(fn () => app(PriceLookup::class)->priceFor('23.2', 'standar', CarbonImmutable::now(),
            new PriceContext($dentist ?? $this->user(self::DOC)->id, $category, $field)));
    }

    public function test_only_umum_seeded_gives_everyone_umum_and_old_signature_stays_umum(): void
    {
        $this->assertSame([250000, 250000, 250000], [$this->price('general'), $this->price('specialist'), $this->price('specialist', 'sp_ort')]);
        $this->inA(fn () => $this->assertSame(0, TariffRate::count()));
        $this->rate('specialist', 300000)->assertOk();
        $this->assertSame(250000, $this->inA(fn () => app(PriceLookup::class)->priceFor('23.2', 'standar', CarbonImmutable::now())));
    }

    public function test_most_specific_cell_wins_and_general_never_gets_specialist_prices(): void
    {
        $this->rate('specialist', 300000)->assertOk();
        $this->assertSame([250000, 300000, 300000], [$this->price('general'), $this->price('specialist'), $this->price('specialist', 'sp_ort')]);

        $this->rate('field', 400000, ['field' => 'sp_ort'])->assertOk();
        $this->assertSame([400000, 300000, 250000], [$this->price('specialist', 'sp_ort'), $this->price('specialist', 'sp_kg'), $this->price('general', 'sp_ort')]);

        $doc = $this->user(self::DOC)->id;
        $this->rate('dentist', 500000, ['dentist_id' => $doc])->assertOk();
        $this->assertSame([500000, 500000], [$this->price('specialist', 'sp_ort'), $this->price('general')]);
        $this->assertSame(400000, $this->price('specialist', 'sp_ort', $this->user('dokter@ceria.test')->id)); // override is per dentist

        // missing Umum still throws even when a band cell exists for another variant
        $this->rate('specialist', 1, [], '99.99')->assertUnprocessable();
        $this->expectException(RuntimeException::class);
        $this->inA(fn () => app(PriceLookup::class)->priceFor('23.2', 'p9', CarbonImmutable::now(), new PriceContext($doc, 'specialist', null)));
    }

    public function test_clear_and_versioning_and_validation(): void
    {
        $this->rate('specialist', 300000)->assertOk();
        $this->rate('specialist', 310000)->assertConflict(); // one version per day, like levels
        $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'specialist',
            'price_rp' => null, 'valid_from' => now()->addDay()->toDateString()])->assertOk();
        $this->assertSame(300000, $this->price('specialist'));
        $this->assertSame(250000, $this->inA(fn () => app(PriceLookup::class)->priceFor('23.2', 'standar', CarbonImmutable::now()->addDay(),
            new PriceContext($this->user(self::DOC)->id, 'specialist', null))));

        $this->rate('field', 1)->assertUnprocessable(); // field required
        $this->rate('field', 1, ['field' => 'sp_xx'])->assertUnprocessable();
        $this->rate('specialist', 1, ['field' => 'sp_ort'])->assertUnprocessable(); // field only for band field
        $this->rate('dentist', 1, ['dentist_id' => $this->user('asisten@senyum.test')->id])->assertNotFound(); // not a dentist here
        $this->rate('dentist', 1, ['dentist_id' => $this->user('dokter@ceria.test')->id])->assertNotFound(); // dentist of tenant B only
        $this->inA(fn () => $this->assertTrue(AuditEvent::where('action', 'tarif_tingkat_diubah')->count() === 2));
        $this->rate('dentist', 450000, ['dentist_id' => $this->user(self::DOC)->id])->assertOk();
        $detail = $this->inA(fn () => AuditEvent::where('action', 'tarif_override_diubah')->firstOrFail()->detail);
        $this->assertSame([450000, '23.2'], [$detail['price_rp'], $detail['procedure_code']]);
    }

    public function test_dentist_profile_api(): void
    {
        $doc = $this->user(self::DOC)->id;
        $this->as(self::OWNER)->putJson("/api/dentists/$doc/profile", ['category' => 'specialist', 'field' => 'sp_bm'])->assertOk()
            ->assertJsonPath('field', 'sp_bm');
        $this->as(self::OWNER)->putJson("/api/dentists/$doc/profile", ['category' => 'general', 'field' => 'sp_bm'])->assertUnprocessable();
        $this->as(self::OWNER)->putJson("/api/dentists/$doc/profile", ['category' => 'specialist', 'field' => 'sp_xx'])->assertUnprocessable();
        $this->as(self::OWNER)->putJson("/api/dentists/{$this->user('asisten@senyum.test')->id}/profile", ['category' => 'general'])->assertNotFound();
        $this->inA(fn () => $this->assertTrue(AuditEvent::where('action', 'profil_dokter_diubah')->exists()));
        $this->inA(fn () => $this->assertSame(['specialist', 'sp_bm'], array_values(DentistProfile::where('user_id', $doc)->firstOrFail()->only(['category', 'field']))));
    }

    public function test_non_owner_cannot_edit_bands_or_profiles(): void
    {
        $doc = $this->user(self::DOC)->id;
        foreach ([self::DOC, 'depan@senyum.test', 'asisten@senyum.test', 'kasir@senyum.test'] as $email) {
            $this->rate('specialist', 1, [], '23.2', $email)->assertForbidden();
            $this->as($email)->putJson("/api/dentists/$doc/profile", ['category' => 'specialist'])->assertForbidden();
        }
    }

    public function test_tenant_isolation_of_bands_and_profiles(): void
    {
        $this->rate('specialist', 300000)->assertOk();
        $this->as(self::OWNER)->putJson("/api/dentists/{$this->user(self::DOC)->id}/profile", ['category' => 'specialist', 'field' => 'sp_ort'])->assertOk();
        Ctx::runAs($this->tenantB()->id, function () {
            $this->assertSame(0, TariffRate::count());
            $this->assertSame(0, DentistProfile::where('user_id', $this->user(self::DOC)->id)->count());
            $this->assertSame(150000, app(PriceLookup::class)->priceFor('23.09', 'standar', CarbonImmutable::now(),
                new PriceContext($this->user(self::DOC)->id, 'specialist', 'sp_ort')));
        });
        // tenant B's owner cannot touch tenant A's dentist profile (not a dentist membership there)
        $this->as('dokter@ceria.test')->putJson("/api/dentists/{$this->user(self::DOC)->id}/profile", ['category' => 'general'])->assertNotFound();
    }

    public function test_sign_as_specialist_with_field_snapshots_winning_band_and_dentist(): void
    {
        $doc = $this->user(self::DOC)->id;
        $this->as(self::OWNER)->putJson("/api/dentists/$doc/profile", ['category' => 'specialist', 'field' => 'sp_kg'])->assertOk();
        $this->rate('specialist', 300000)->assertOk();
        $this->rate('field', 420000, ['field' => 'sp_kg'])->assertOk();

        $v = $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/approve-drafts")->assertOk(); // seeded agent finding needs Setujui
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
        $line = $this->inA(fn () => InvoiceLine::where('procedure_code', '23.2')->where('tooth', 11)->firstOrFail());
        $this->assertSame([420000, $doc, 'specialist', 'sp_kg', 'I'], [$line->price_rp, $line->doctor_id, $line->dentist_category, $line->dentist_field, $line->surface]);
        $this->assertNotNull($line->procedure_name);

        // later tariff edits do not touch the snapshot
        $this->as(self::OWNER)->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'field', 'field' => 'sp_kg',
            'price_rp' => 999000, 'valid_from' => now()->addDay()->toDateString()])->assertOk();
        $this->assertSame(420000, $this->inA(fn () => $line->fresh()->price_rp));
    }

    public function test_status_change_as_general_dentist_snapshots_umum(): void
    {
        $this->rate('specialist', 300000)->assertOk(); // must not reach a general dentist
        $doc = $this->user(self::DOC)->id;
        $old = $this->inA(fn () => ProcedureRecord::where('tooth', 18)->where('state', 'final')->firstOrFail());
        $new = $this->as(self::DOC)->postJson("/api/procedures/{$old->id}/status", ['to' => 'selesai'])->assertCreated()->json('id');
        $line = $this->inA(fn () => InvoiceLine::where('procedure_id', $new)->firstOrFail());
        $this->assertSame([150000, $doc, 'general', null], [$line->price_rp, $line->doctor_id, $line->dentist_category, $line->dentist_field]);
    }
}
