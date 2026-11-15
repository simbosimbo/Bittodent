<?php

namespace Tests\Modules\Reporting;

use App\Modules\Billing\Models\PaymentAccount;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tenancy\Models\DentistProfile;
use App\Modules\Tenancy\Models\Membership;
use Database\Seeders\DatabaseSeeder;
use Tests\Modules\Billing\BilledVisit;
use Tests\TestCase;

// Unit D koreksi (DEVIATIONS #58): the owner integrity report keeps clinical corrections, credit notes, voids, refunds, 100% discounts
// and Rp0 tariff lines in separate columns per dentist. A credit note / void is never counted as "Rp0".
class IntegrityCorrectionMetricsTest extends TestCase
{
    use BilledVisit;

    private string $range;

    private function report(string $as = self::OWNER): array
    {
        return $this->as($as)->getJson("/api/reports/integrity?$this->range")->assertOk()->json();
    }

    private function row(array $report, string $dentist): array
    {
        return array_column($report['dentists'], null, 'dentist_id')[$dentist];
    }

    /** Non-zero changes of one dentist's row between two reports. */
    private function delta(array $after, array $before, string $dentist): array
    {
        $a = $this->row($after, $dentist);
        $b = array_column($before['dentists'], null, 'dentist_id')[$dentist] ?? array_map(fn () => 0, $a);

        return array_filter(array_map(fn ($k) => is_int($a[$k]) ? $a[$k] - $b[$k] : 0, array_combine(array_keys($a), array_keys($a))));
    }

    private function alerts(array $report, string $kind): array
    {
        return array_values(array_filter($report['alerts'], fn ($a) => $a['kind'] === $kind));
    }

    public function test_each_correction_kind_has_its_own_count_and_total_per_dentist(): void
    {
        $this->range = 'from='.now('Asia/Jakarta')->subDays(10)->toDateString().'&to='.now('Asia/Jakarta')->addDays(10)->toDateString();
        $doc = $this->user(self::DOC)->id;
        $doc2 = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Budi Contoh', 'dokter_gigi')->id;
        $this->in($this->tenantA(), function () use ($doc2) {
            Membership::create(['user_id' => $doc2, 'role' => 'dentist']);
            DentistProfile::create(['user_id' => $doc2, 'category' => 'general']);
            Tariff::create(['procedure_code' => '23.01', 'name' => 'Cabut gigi susu (gratis contoh)', 'variant' => 'gratis',
                'level_label' => 'Gratis', 'price_rp' => 0, 'valid_from' => '2026-01-01']);
        });
        $by2 = ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2', 'provider_id' => $doc2];
        $before = $this->report();

        // dokter 1: tidak_dikerjakan within the window -> full credit note (pending -> approved by the owner)
        [, $p1, $i1] = $this->billed();
        $price = $this->invoice($i1)['lines'][0]['price_rp'];
        $this->correct($p1, ['reason_type' => 'tidak_dikerjakan'])->assertCreated();
        $mid = $this->report();
        $this->assertSame(['cn_pending' => 1, 'cn_pending_rp' => $price], array_intersect_key($this->delta($mid, $before, $doc), ['cn_pending' => 0, 'cn_pending_rp' => 0]));
        $this->assertNotEmpty(array_filter($this->alerts($mid, 'pembalikan_menunggu'), fn ($a) => $a['detail']['type'] === 'nota_kredit' && $a['dentist_id'] === $doc));
        $nk1 = $this->invoice($i1)['credit_notes'][0]['id'];
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nk1/approve")->assertOk();

        // dokter 1: paid, full credit note approved, refund approved
        [, , $i2] = $this->billed();
        $acc = $this->in($this->tenantA(), fn () => PaymentAccount::where('name', 'QRIS klinik')->value('id'));
        $pay = $this->as(self::KASIR)->postJson("/api/invoices/$i2/payments", ['payment_account_id' => $acc, 'amount_rp' => $price])
            ->assertCreated()->json('payments.0.id');
        $nk2 = $this->credit($i2, $this->invoice($i2)['lines'][0]['id'], $price)->assertStatus(202)->json('credit_note_id');
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nk2/approve")->assertOk();
        $rf = $this->as(self::KASIR)->postJson("/api/invoices/$i2/refunds", ['payment_id' => $pay, 'credit_note_id' => $nk2, 'amount_rp' => $price,
            'reason' => 'Pasien sudah bayar, tindakan dikoreksi'])->assertStatus(202)->json('refund_id');
        $this->as(self::OWNER)->postJson("/api/refunds/$rf/approve")->assertOk();

        // dokter 1: one void approved, one void pending; one 100% discount approved (a discount, not a correction)
        [, , $i3] = $this->billed();
        $v3 = $this->as(self::KASIR)->postJson("/api/invoices/$i3/void", ['reason' => 'Tagihan dobel dibuat'])->assertStatus(202)->json('invoice_void_id');
        $this->as(self::OWNER)->postJson("/api/invoice-voids/$v3/approve")->assertOk();
        [, , $i4] = $this->billed();
        $this->as(self::KASIR)->postJson("/api/invoices/$i4/void", ['reason' => 'Tagihan dobel dibuat'])->assertStatus(202);
        [, , $i5] = $this->billed();
        $this->as(self::KASIR)->postJson("/api/invoices/$i5/adjustments", ['kind' => 'discount', 'amount_rp' => $price, 'reason' => 'Diskon penuh uji'])
            ->assertStatus(202);
        $adj = $this->invoice($i5)['adjustments'][0]['id'];
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$adj/approve")->assertOk();

        // dokter 2 (provider of work in dokter 1's visits): partial credit note, salah_situs left unreviewed, Rp0 tariff line
        [, $p6, $i6] = $this->billed(proc: $by2);
        $this->credit($i6, $this->invoice($i6)['lines'][0]['id'], 10000)->assertCreated();
        $situs = $this->correct($p6, ['reason_type' => 'salah_situs', 'surfaces' => 'O'])->assertCreated()->json('id');
        $this->billed(proc: ['tooth' => 51, 'procedure_code' => '23.01', 'variant' => 'gratis', 'provider_id' => $doc2]);

        // 3 days later: the flag is stale; a code correction outside the window waits, then the owner approves it
        $this->travel(3)->days();
        $late = $this->correct($situs, ['reason_type' => 'salah_kode', 'procedure_code' => '23.3'])->assertStatus(202)->json('correction_id');
        $mid = $this->report();
        $this->assertSame([$late], array_column(array_filter($this->alerts($mid, 'koreksi_menunggu'), fn ($a) => $a['dentist_id'] === $doc2), 'ref_id'));
        $this->assertNotEmpty(array_filter($this->alerts($mid, 'tinjau_koreksi_lama'), fn ($a) => $a['dentist_id'] === $doc2 && $a['detail']['reason_type'] === 'salah_situs'));
        $this->assertNotEmpty(array_filter($this->alerts($mid, 'tarif_nol'), fn ($a) => $a['dentist_id'] === $doc2 && $a['detail']['procedure_code'] === '23.01'));
        $this->assertSame(1, $this->delta($mid, $before, $doc2)['corr_pending']);
        $this->as(self::OWNER)->postJson("/api/procedure-corrections/$late/approve")->assertOk();

        $after = $this->report();
        $this->assertSame([
            'rp0' => 1, 'full_discount_rp' => $price, 'discounts' => 1, 'discount_total_rp' => $price, 'full_discounts' => 1, // the 100% discount only
            'corr_tidak_dikerjakan' => 1, 'corr_total_rp' => $price,
            'cn_full' => 2, 'cn_full_rp' => 2 * $price, 'cn_approved' => 2,
            'refunds' => 1, 'refund_rp' => $price,
            'voids' => 1, 'void_rp' => $price, 'void_pending' => 1, 'void_pending_rp' => $price,
        ], $this->delta($after, $before, $doc));
        $this->assertSame([
            'tariff_zero' => 1, 'tariff_zero_pending' => 1, // anomali tarif, not rp0
            'corr_salah_kode' => 1, 'corr_salah_situs' => 1, 'corr_total_rp' => 2 * $price,
            'corr_outside_window' => 1, 'corr_owner_approved' => 1,
            'cn_partial' => 1, 'cn_partial_rp' => 10000,
        ], $this->delta($after, $before, $doc2));
        $this->assertSame($after['totals']['cn_full'], array_sum(array_column($after['dentists'], 'cn_full')));
    }

    public function test_sole_owner_reversal_is_flagged_and_tenants_are_isolated(): void
    {
        $this->range = 'from='.now('Asia/Jakarta')->startOfMonth()->toDateString();
        [, , $inv] = $this->billed('dokter@ceria.test');
        $line = $this->invoice($inv, 'kasir@ceria.test')['lines'][0];
        $nk = $this->credit($inv, $line['id'], $line['price_rp'], 'kasir@ceria.test')->assertStatus(202)->json('credit_note_id');
        $this->as('dokter@ceria.test')->postJson("/api/credit-notes/$nk/approve")->assertOk();

        $b = $this->report('dokter@ceria.test');
        $row = $this->row($b, $this->user('dokter@ceria.test')->id);
        $this->assertSame([1, 1, 0], [$row['reversal_self_approved'], $row['cn_full'], $row['rp0']]);
        $this->assertSame([$nk], array_column($this->alerts($b, 'pembalikan_disetujui_sendiri'), 'ref_id'));

        $a = $this->report();
        $this->assertSame(0, $a['totals']['reversal_self_approved']);
        $this->assertFalse(collect($a['alerts'])->contains(fn ($x) => $x['ref_id'] === $nk));
        foreach ([self::DOC, self::KASIR, self::DESK] as $who) {
            $this->as($who)->getJson('/api/reports/integrity')->assertForbidden();
        }
    }
}
