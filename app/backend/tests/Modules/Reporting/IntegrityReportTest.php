<?php

namespace Tests\Modules\Reporting;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

// Unit 6 (DEVIATIONS #52): owner integrity report per dentist + alerts. Counts are compared as deltas over the seeded month.
class IntegrityReportTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const DESK = 'depan@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private const NO_TARIFF = ['tooth' => 21, 'procedure_code' => '23.41']; // no seeded tariff => no invoice line

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** @return array{0: string, 1: string} [visit id, appointment id] */
    private function visit(): array
    {
        $appt = $this->inA(function () {
            $branch = Membership::where('user_id', $this->user(self::DESK)->id)->value('branch_id');

            return Appointment::where('branch_id', $branch)->where('status', 'booked')->whereNotIn('patient_id', Visit::select('patient_id'))
                ->orderBy('starts_at')->firstOrFail();
        });
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();

        return [$visit, $appt->id];
    }

    private function proc(string $visit, array $body)
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", $body + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
    }

    private function sign(string $visit): void
    {
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
    }

    /** @return array<string, array> dentist id => row */
    private function byDentist(array $report): array
    {
        return array_column($report['dentists'], null, 'dentist_id');
    }

    private function delta(array $after, array $before, string $dentist): array
    {
        $a = $this->byDentist($after)[$dentist];
        $b = $this->byDentist($before)[$dentist] ?? array_map(fn () => 0, $a);

        return array_filter(array_map(fn ($k) => is_int($a[$k]) ? $a[$k] - $b[$k] : 0, array_combine(array_keys($a), array_keys($a))));
    }

    public function test_counts_per_dentist_and_alerts(): void
    {
        $doc = $this->user(self::DOC)->id;
        $doc2 = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Budi Contoh', 'dokter_gigi');
        $this->inA(fn () => Membership::create(['user_id' => $doc2->id, 'role' => 'dentist']));
        $before = $this->as(self::OWNER)->getJson('/api/reports/integrity')->assertOk()->json();

        // (1) normal billed visit + an external by dentist 2 recorded after today's `selesai` (pending -> confirmed) + small discount + pending 100%
        [$v1] = $this->visit();
        $this->proc($v1, ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2']);
        $ext = $this->proc($v1, ['tooth' => 26, 'treat_area' => 'tooth', 'provider_id' => $doc2->id, 'status' => 'external',
            'external_clinic_name' => 'Klinik Contoh Lain', 'external_date' => '06/2025'])->assertJsonPath('external_confirmation', 'pending')->json('id');
        $this->as(self::DESK)->postJson("/api/procedures/$ext/confirm-external", ['confirm' => true])->assertOk();
        $this->sign($v1); // Selesai also closes the visit
        $inv = $this->inA(fn () => Invoice::where('visit_id', $v1)->value('id'));
        $balance = $this->as(self::DESK)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 10000, 'reason' => 'Diskon kecil uji'])
            ->assertCreated()->json('balance_rp');
        $pending = $this->as(self::DESK)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => $balance, 'reason' => 'Diskon penuh uji'])
            ->assertStatus(202)->json('adjustments.1.id');

        // (2) unbilled `selesai`, visit still open
        [$v2] = $this->visit();
        $this->proc($v2, self::NO_TARIFF);
        $this->as(self::DOC)->postJson("/api/visits/$v2/selesai", ['revision' => 1, 'confirm' => true])->assertConflict()
            ->assertJsonPath('error', 'invoice_required'); // #54: Selesai refused, work stays an unsigned `selesai` draft

        // (3) unbilled `selesai` but the appointment was cancelled: closed without invoice => batal, not tanpa tagihan
        [$v3, $appt3] = $this->visit();
        $this->proc($v3, self::NO_TARIFF);
        $this->as(self::DESK)->postJson("/api/appointments/$appt3/transition", ['to' => 'cancelled'])->assertOk();
        $this->as(self::DESK)->postJson("/api/visits/$v3/close", ['reason' => 'Pasien batal hadir, dicatat front desk'])->assertOk()
            ->assertJsonPath('closed_without_invoice', true);

        $after = $this->as(self::OWNER)->getJson('/api/reports/integrity')->assertOk()->json();
        $this->assertSame(['external' => 1], $this->delta($after, $before, $doc2->id));
        $this->assertSame(['rp0_pending' => 1, 'discounts' => 1, 'discount_total_rp' => 10000, 'full_discounts' => 1, 'unbilled_visits' => 1,
            'batal' => 1, 'closed_without_invoice' => 1], $this->delta($after, $before, $doc));
        $this->assertSame('drg. Budi Contoh', $this->byDentist($after)[$doc2->id]['name']);
        $this->assertSame($after['totals']['batal'], array_sum(array_column($after['dentists'], 'batal')));

        $alerts = collect($after['alerts']);
        $this->assertSame([$v2], $alerts->where('kind', 'tanpa_tagihan')->pluck('visit_id')->intersect([$v1, $v2, $v3])->values()->all());
        $this->assertSame([$v3], $alerts->where('kind', 'batal_tanpa_tagihan')->pluck('visit_id')->intersect([$v3])->values()->all());
        $this->assertTrue($alerts->contains(fn ($a) => $a['kind'] === 'luar_setelah_datang' && $a['ref_id'] === $ext && $a['dentist_id'] === $doc2->id));
        $this->assertTrue($alerts->contains(fn ($a) => $a['kind'] === 'rp0_menunggu' && $a['ref_id'] === $pending && $a['patient_name'] !== null));
        $at = $alerts->pluck('at')->all();
        $sorted = $at;
        rsort($sorted);
        $this->assertSame($sorted, $at, 'newest first');
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'laporan_dibuka')->where('actor_id', $this->user(self::OWNER)->id)->exists()));

        // the owner's audit log shows the integrity actions (confirm external, close without invoice; approval below)
        $log = fn (string $action) => array_column($this->as(self::OWNER)->getJson("/api/audit-events?action=$action")->assertOk()->json('data'), 'entity_id');
        $this->assertContains($ext, $log('konfirmasi_tindakan_luar'));
        $this->assertContains($v3, $log('tutup'));
        $this->assertContains($inv, $log('penyesuaian_menunggu'));

        // once approved by the (non-dentist) owner: Rp0 counted, not self-approved
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$pending/approve")->assertOk();
        $approved = $this->as(self::OWNER)->getJson('/api/reports/integrity')->assertOk()->json();
        $this->assertSame(1, $this->delta($approved, $before, $doc)['rp0']);
        $this->assertArrayNotHasKey('self_approved', $this->delta($approved, $before, $doc));
        $this->assertContains($inv, $log('penyesuaian_disetujui'));
    }

    public function test_sole_owner_self_approval_is_flagged_and_tenants_are_isolated(): void
    {
        $b = $this->tenantB()->id;
        $inv = Ctx::runAs($b, fn () => Invoice::orderBy('created_at')->firstOrFail());
        $balance = $this->as('kasir@ceria.test')->getJson("/api/invoices/{$inv->id}")->json('balance_rp');
        $this->as('kasir@ceria.test')->postJson("/api/invoices/{$inv->id}/adjustments", ['kind' => 'write_off', 'amount_rp' => $balance,
            'reason' => 'Hapus penuh uji'])->assertStatus(202);
        $id = Ctx::runAs($b, fn () => InvoiceAdjustment::where('invoice_id', $inv->id)->where('requires_approval', true)->value('id'));
        $this->as('dokter@ceria.test')->postJson("/api/invoice-adjustments/$id/approve")->assertOk();

        $report = $this->as('dokter@ceria.test')->getJson('/api/reports/integrity?from='.now('Asia/Jakarta')->startOfMonth()->toDateString())->assertOk()->json();
        $row = $this->byDentist($report)[$this->user('dokter@ceria.test')->id];
        $this->assertGreaterThanOrEqual(1, $row['self_approved']);
        $this->assertGreaterThanOrEqual(1, $row['rp0']);
        $this->assertTrue(collect($report['alerts'])->contains(fn ($a) => $a['kind'] === 'disetujui_sendiri' && $a['ref_id'] === $id));

        // tenant A owner sees none of tenant B
        $a = $this->as(self::OWNER)->getJson('/api/reports/integrity')->assertOk()->json();
        $this->assertArrayNotHasKey($this->user('dokter@ceria.test')->id, $this->byDentist($a));
        $this->assertFalse(collect($a['alerts'])->contains(fn ($x) => $x['ref_id'] === $id));
    }

    public function test_only_owner_and_valid_range(): void
    {
        foreach ([self::DOC, self::DESK, 'kasir@senyum.test', 'asisten@senyum.test'] as $who) {
            $this->as($who)->getJson('/api/reports/integrity')->assertForbidden();
        }
        $this->as(self::OWNER)->getJson('/api/reports/integrity?from=2026-11-10&to=2026-11-01')->assertUnprocessable();
        $this->as(self::OWNER)->getJson('/api/reports/integrity?from=2024-01-01&to=2026-11-01')->assertUnprocessable();
        $this->as(self::OWNER)->getJson('/api/reports/integrity?from=2026-11-01&to=2026-11-14')->assertOk()
            ->assertJsonPath('from', '2026-11-01')->assertJsonPath('timezone', 'Asia/Jakarta');
    }
}
