<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Audit\AuditEvent;
use Tests\TestCase;

// GET /api/billing/invoice-status?visit_ids=…: the Jadwal "Belum bayar" lookup in one request (was one call per finished visit).
class InvoiceStatusBatchTest extends TestCase
{
    use BilledVisit;

    private const URL = '/api/billing/invoice-status?visit_ids=';

    public function test_billing_readers_get_statuses_for_many_visits_in_one_call(): void
    {
        [$visit, , $inv] = $this->billed();
        $none = '00000000-0000-4000-8000-000000000000'; // a visit without an invoice is simply absent
        foreach ([self::OWNER, self::DESK, self::KASIR] as $email) {
            $this->as($email)->getJson(self::URL."$visit,$none,not-a-uuid")->assertOk()
                ->assertJsonPath("statuses.$visit", 'terbuka')->assertJsonMissingPath("statuses.$none");
        }
        $this->as(self::DOC)->getJson(self::URL.$visit)->assertForbidden();
        $this->as('asisten@senyum.test')->getJson(self::URL.$visit)->assertForbidden();
        $this->assertTrue($this->in($this->tenantA(), fn () => AuditEvent::where('action', 'baca')->where('entity_type', 'invoice_status')->exists()));
        $this->as(self::KASIR)->getJson(self::URL)->assertOk()->assertExactJson(['statuses' => []]);
        $this->assertNotNull($inv);
    }

    public function test_other_tenant_and_uncovered_branch_see_nothing_and_size_is_capped(): void
    {
        [$visit] = $this->billed();
        $this->as('kasir@ceria.test')->getJson(self::URL.$visit)->assertOk()->assertExactJson(['statuses' => []]);
        // an invoice of a branch the membership does not cover is left out (front desk = Kemang only; the owner covers all)
        $raw = $this->in($this->tenantA(), fn () => Branch::where('name', 'like', 'Senyum Sehat Rawamangun%')->value('id'));
        $this->in($this->tenantA(), fn () => Invoice::where('visit_id', $visit)->update(['branch_id' => $raw]));
        $this->as(self::DESK)->getJson(self::URL.$visit)->assertOk()->assertExactJson(['statuses' => []]);
        $this->as(self::OWNER)->getJson(self::URL.$visit)->assertOk()->assertJsonPath("statuses.$visit", 'terbuka');
        $many = implode(',', array_map(fn ($i) => sprintf('00000000-0000-4000-8000-%012d', $i), range(1, 201)));
        $this->as(self::KASIR)->getJson(self::URL.$many)->assertStatus(422);
    }
}
