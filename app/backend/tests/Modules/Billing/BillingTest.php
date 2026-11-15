<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Tariffs\Contracts\PriceLookup;
use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class BillingTest extends TestCase
{
    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function invoice(): Invoice
    {
        return $this->inA(fn () => Invoice::orderBy('created_at')->firstOrFail());
    }

    public function test_balance_is_lines_minus_adjustments_in_integer_rupiah(): void
    {
        $id = $this->invoice()->id;
        $this->as('depan@senyum.test')->getJson("/api/invoices/$id")->assertOk()
            ->assertJsonPath('lines_rp', 250000)->assertJsonPath('adjustments_rp', 25000)->assertJsonPath('balance_rp', 225000)
            ->assertJsonPath('lines.0.price_rp', 250000);
        $r = $this->as('pemilik@senyum.test');
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'write_off', 'amount_rp' => 50000, 'reason' => 'Penghapusan uji'])
            ->assertCreated()->assertJsonPath('balance_rp', 175000)->assertJsonCount(2, 'adjustments');
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'correction', 'amount_rp' => -10000, 'reason' => 'Koreksi salah input',
            'invoice_line_id' => $r->getJson("/api/invoices/$id")->json('lines.0.id')])
            ->assertCreated()->assertJsonPath('balance_rp', 185000);
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'discount', 'amount_rp' => -5, 'reason' => 'Negatif tidak boleh'])->assertUnprocessable();
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'discount', 'amount_rp' => 1.5, 'reason' => 'Bukan bilangan bulat'])->assertUnprocessable();
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'discount', 'amount_rp' => 185001, 'reason' => 'Melebihi saldo'])->assertUnprocessable();
        $r->postJson("/api/invoices/$id/adjustments", ['kind' => 'discount', 'amount_rp' => 1000])->assertUnprocessable(); // reason required
    }

    public function test_only_front_desk_and_owner_touch_billing(): void
    {
        $id = $this->invoice()->id;
        $body = ['kind' => 'discount', 'amount_rp' => 1000, 'reason' => 'Uji izin'];
        $this->as('dokter@senyum.test')->postJson("/api/invoices/$id/adjustments", $body)->assertForbidden();
        $this->as('asisten@senyum.test')->postJson("/api/invoices/$id/adjustments", $body)->assertForbidden();
        $this->as('dokter@senyum.test')->getJson("/api/invoices/$id")->assertForbidden();
        $this->as('depan@senyum.test')->postJson("/api/invoices/$id/adjustments", $body)->assertCreated();
        $this->as('depan@senyum.test')->getJson("/api/visits/{$this->invoice()->visit_id}/invoice")->assertOk()->assertJsonPath('id', $id);
    }

    public function test_no_billing_route_accepts_a_price(): void
    {
        $billing = collect(Route::getRoutes()->getRoutes())->filter(fn ($r) => str_contains($r->getActionName(), 'Modules\\Billing\\'));
        $this->assertNotEmpty($billing);
        $code = file_get_contents(app_path('Modules/Billing/Http/Controllers/InvoiceController.php'));
        $this->assertDoesNotMatchRegularExpression("/'price_rp'\\s*=>\\s*\\[/", $code); // no validation rule for a typed price
    }

    public function test_price_lookup_by_date_and_snapshot_is_frozen(): void
    {
        $prices = app(PriceLookup::class);
        $this->inA(function () use ($prices) {
            $this->assertSame(200000, $prices->priceFor('23.2', 'standar', CarbonImmutable::parse('2025-06-01')));
            $this->assertSame(250000, $prices->priceFor('23.2', 'standar', CarbonImmutable::parse('2026-06-01')));
            $this->assertSame(350000, $prices->priceFor('23.2', 'p2', CarbonImmutable::parse('2026-06-01')));
            Tariff::create(['procedure_code' => '23.2', 'name' => 'Tumpatan (uji)', 'variant' => 'standar', 'price_rp' => 300000, 'valid_from' => '2026-07-01']);
            $this->assertSame(300000, $prices->priceFor('23.2', 'standar', CarbonImmutable::parse('2026-08-01')));
            $this->assertSame(250000, InvoiceLine::orderBy('created_at')->firstOrFail()->price_rp); // old line keeps its snapshot
            $this->expectException(RuntimeException::class);
            $prices->priceFor('99.9', 'standar', CarbonImmutable::parse('2026-06-01'));
        });
    }
}
