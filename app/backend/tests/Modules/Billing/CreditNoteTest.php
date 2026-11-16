<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Unit B koreksi (DEVIATIONS #56): financial corrections are their own documents (credit note NK-..., void), never a Rp0 line or a
// 100% discount; original lines never change; full reversals need an owner (conflict-of-interest rule of unit 4).
class CreditNoteTest extends TestCase
{
    use BilledVisit;

    public function test_not_done_correction_creates_a_pending_full_credit_note_never_a_rp0_line_or_discount(): void
    {
        [$visit, $proc, $inv, $unbilled] = $this->billed(open: true); // signed, still open (unbilled second row)
        $before = $this->invoice($inv);
        $line = $before['lines'][0];

        $corr = $this->correct($proc, ['reason_type' => 'tidak_dikerjakan'])->assertCreated()->json('correction_id');
        $after = $this->invoice($inv);
        $this->assertCount(1, $after['credit_notes']);
        $nk = $after['credit_notes'][0];
        $this->assertSame([$line['id'], $corr, $line['price_rp'], true, 'tidak_dikerjakan', 'pending'],
            [$nk['invoice_line_id'], $nk['procedure_correction_id'], $nk['amount_rp'], $nk['is_full'], $nk['reason_type'], $nk['status']]);
        $this->assertMatchesRegularExpression('/^NK-\d{4}-000001$/', $nk['number']);
        $this->assertSame($before['balance_rp'], $after['balance_rp']); // pending: nothing moves yet
        $this->assertSame([], $after['adjustments']); // no discount
        $this->assertSame(1, $this->in($this->tenantA(), fn () => InvoiceLine::where('invoice_id', $inv)->count()));
        $this->assertFalse($this->in($this->tenantA(), fn () => InvoiceLine::where('price_rp', 0)->exists()));

        // pending reversal is not "handled": the visit cannot close yet, neither by desk /close nor by the DPJP's Selesai
        $this->assertEqualsCanonicalizing([$unbilled, $proc], $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()
            ->assertJsonPath('error', 'invoice_required')->json('procedure_ids'));
        $this->selesai($visit)->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->assertSignedOpen($visit);

        $this->as(self::KASIR)->postJson("/api/credit-notes/{$nk['id']}/approve")->assertForbidden();
        $this->as(self::DOC)->postJson("/api/credit-notes/{$nk['id']}/approve")->assertForbidden();
        $pending = $this->as(self::OWNER)->getJson('/api/billing/reversals/pending')->assertOk()->json('credit_notes');
        $this->assertSame([$nk['id']], array_column($pending, 'id'));

        $done = $this->as(self::OWNER)->postJson("/api/credit-notes/{$nk['id']}/approve")->assertOk()->json();
        $this->assertSame($before['balance_rp'] - $line['price_rp'], $done['balance_rp']);
        $this->assertSame('approved', $done['credit_notes'][0]['status']);
        $this->assertNotSame('lunas', $done['status']); // never "lunas Rp0"
        $this->assertSame([$nk['number']], $done['lines'][0]['credit_note_numbers']);
        $this->assertSame($line['price_rp'], $done['lines'][0]['credited_rp']);
        foreach (['procedure_code', 'procedure_name', 'price_rp', 'tooth', 'surface'] as $f) { // original snapshot untouched
            $this->assertSame($line[$f], $done['lines'][0][$f], $f);
        }
        $this->as(self::OWNER)->postJson("/api/credit-notes/{$nk['id']}/approve")->assertConflict()->assertJsonPath('error', 'not_pending');
        // approved = handled; only the unbilled row still blocks, until it is corrected to tidak_dikerjakan (no credit note needed)
        $this->selesai($visit)->assertConflict()->assertJsonPath('procedure_ids', [$unbilled]);
        $this->correct($unbilled, ['reason_type' => 'tidak_dikerjakan'])->assertCreated();
        $this->selesai($visit)->assertOk()->assertJsonPath('visit.status', 'selesai'); // close only: same signature
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'visit_closed');
        foreach (['nota_kredit.menunggu', 'nota_kredit.disetujui'] as $a) {
            $this->assertTrue($this->audited($a, $this->tenantA()), $a);
        }
    }

    public function test_not_done_on_unbilled_work_needs_nothing_to_close(): void
    {
        [$visit, $proc] = $this->billed(proc: ['tooth' => 21, 'procedure_code' => '23.41']); // no tariff => no line: signed, open (#55)
        $this->assertSignedOpen($visit);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->correct($proc, ['reason_type' => 'tidak_dikerjakan'])->assertCreated();
        $this->assertSame(0, $this->in($this->tenantA(), fn () => CreditNote::count()));
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertOk();
    }

    public function test_site_correction_flags_the_line_cashier_credits_and_bills_the_corrected_tariff(): void
    {
        [, $proc, $inv] = $this->billed();
        $old = $this->invoice($inv)['lines'][0];
        $corr = $this->correct($proc, ['reason_type' => 'salah_situs', 'surfaces' => 'O'])->assertCreated()->json('correction_id');

        $i = $this->invoice($inv);
        $this->assertCount(1, $i['lines']); // no automatic line, no money moved
        $this->assertSame([], $i['credit_notes']);
        $this->assertSame([$corr, 'perlu_tinjau'], [$i['lines'][0]['correction_reviews'][0]['procedure_correction_id'], $i['lines'][0]['correction_reviews'][0]['status']]);

        $nk = $this->credit($inv, $old['id'], $old['price_rp'], extra: ['reason_type' => 'salah_situs', 'procedure_correction_id' => $corr])
            ->assertStatus(202)->json('credit_note_id');
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nk/approve")->assertOk();
        $billed = $this->as(self::KASIR)->postJson("/api/invoices/$inv/lines/from-correction/$corr")->assertCreated()->json();
        $this->assertCount(2, $billed['lines']);
        $new = $billed['lines'][1];
        $this->assertSame(['23.2', 'O', 250000], [$new['procedure_code'], $new['surface'], $new['price_rp']]); // corrected tariff snapshot
        $this->assertSame(250000, $billed['balance_rp']);
        $this->assertSame('selesai', $billed['lines'][0]['correction_reviews'][0]['status']);
        foreach (['procedure_code', 'procedure_name', 'price_rp', 'surface'] as $f) {
            $this->assertSame($old[$f], $billed['lines'][0][$f], $f);
        }
        // idempotent
        $this->assertCount(2, $this->as(self::KASIR)->postJson("/api/invoices/$inv/lines/from-correction/$corr")->assertOk()->json('lines'));
        $this->assertTrue($this->audited('koreksi_tagihan.ditagih', $this->tenantA()));
    }

    public function test_code_correction_never_bills_automatically_and_same_price_can_be_marked_reviewed(): void
    {
        [, $proc, $inv] = $this->billed();
        $corr = $this->correct($proc, ['reason_type' => 'salah_kode', 'procedure_code' => '23.3'])->assertCreated()->json('correction_id');
        $i = $this->invoice($inv);
        $this->assertCount(1, $i['lines']);
        $review = $i['lines'][0]['correction_reviews'][0];
        // corrected code has no tariff: billing it is refused, nothing invented
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/lines/from-correction/$corr")->assertUnprocessable()->assertJsonPath('error', 'tariff_missing');
        $this->as(self::KASIR)->postJson("/api/line-corrections/{$review['id']}/review", ['reason' => 'Harga sama, tidak ada selisih'])->assertOk()
            ->assertJsonPath('lines.0.correction_reviews.0.status', 'selesai')->assertJsonPath('balance_rp', $i['balance_rp']);
        $this->as(self::KASIR)->postJson("/api/line-corrections/{$review['id']}/review", ['reason' => 'Tinjau lagi'])->assertConflict();
        $this->assertTrue($this->audited('koreksi_tagihan.ditinjau', $this->tenantA()));
    }

    public function test_partial_credit_applies_for_kasir_full_waits_and_amount_is_capped(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $this->credit($inv, $line['id'], 50000)->assertCreated()->assertJsonPath('balance_rp', $line['price_rp'] - 50000)
            ->assertJsonPath('credit_notes.0.status', 'applied');
        $this->credit($inv, $line['id'], $line['price_rp'])->assertUnprocessable(); // above what is left on the line
        // the rest of the line = full => owner
        $this->credit($inv, $line['id'], $line['price_rp'] - 50000)->assertStatus(202)->assertJsonPath('credit_notes.1.status', 'pending')
            ->assertJsonPath('balance_rp', $line['price_rp'] - 50000);
        $this->credit($inv, $line['id'], 1)->assertUnprocessable(); // pending one reserves its amount
        $this->credit($inv, $line['id'], 1, 'asisten@senyum.test')->assertForbidden();
        $this->assertTrue($this->audited('nota_kredit.dibuat', $this->tenantA()));
    }

    public function test_owner_who_performed_the_work_needs_another_owner_sole_owner_is_flagged(): void
    {
        $this->in($this->tenantA(), fn () => Membership::create(['user_id' => $this->user(self::DOC)->id, 'role' => 'owner', 'branch_id' => null]));
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $nk = $this->credit($inv, $line['id'], $line['price_rp'])->assertStatus(202)->json('credit_note_id');
        $this->as(self::DOC)->postJson("/api/credit-notes/$nk/approve")->assertForbidden()->assertJsonPath('error', 'conflict_of_interest');
        $this->assertTrue($this->audited('nota_kredit.konflik', $this->tenantA()));
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nk/approve")->assertOk()->assertJsonPath('credit_notes.0.self_approved_sole_owner', false);

        // tenant B: dokter@ceria.test is the only owner and the dentist
        [, , $invB] = $this->billed('dokter@ceria.test');
        $lineB = $this->invoice($invB, 'kasir@ceria.test')['lines'][0];
        $nkB = $this->credit($invB, $lineB['id'], $lineB['price_rp'], 'kasir@ceria.test')->assertStatus(202)
            ->assertJsonPath('credit_notes.0.number', $this->invoice($inv)['credit_notes'][0]['number']) // numbering per tenant: both 000001
            ->json('credit_note_id');
        $this->as('dokter@ceria.test')->postJson("/api/credit-notes/$nkB/approve")->assertOk()
            ->assertJsonPath('credit_notes.0.self_approved_sole_owner', true)->assertJsonPath('balance_rp', 0);
        // tenant isolation: A's owner cannot see or decide B's credit note
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nkB/reject")->assertNotFound();
        $this->assertSame([], $this->as(self::OWNER)->getJson('/api/billing/reversals/pending')->json('credit_notes'));
    }

    public function test_numbers_are_sequential_per_tenant(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0]['id'];
        $this->credit($inv, $line, 1000)->assertCreated();
        $this->credit($inv, $line, 2000)->assertCreated();
        $year = now()->format('Y');
        $this->assertSame(["NK-$year-000001", "NK-$year-000002"], array_column($this->invoice($inv)['credit_notes'], 'number'));
        [, , $invB] = $this->billed('dokter@ceria.test');
        $this->credit($invB, $this->invoice($invB, 'kasir@ceria.test')['lines'][0]['id'], 1000, 'kasir@ceria.test')
            ->assertCreated()->assertJsonPath('credit_notes.0.number', "NK-$year-000001");
    }

    public function test_void_only_without_payments_billed_lines_need_owner(): void
    {
        [$visit, $proc, $inv, $unbilled] = $this->billed(open: true); // signed, still open (unbilled second row)
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/void", ['reason' => 'x'])->assertUnprocessable(); // reason >= 10
        $v = $this->as(self::KASIR)->postJson("/api/invoices/$inv/void", ['reason' => 'Tagihan dobel dibuat'])->assertStatus(202)
            ->assertJsonPath('status', 'terbuka')->json('invoice_void_id');
        // only the pending void is left blocking: Selesai and /close both refuse, the note stays signed
        $this->correct($unbilled, ['reason_type' => 'tidak_dikerjakan'])->assertCreated();
        $this->selesai($visit)->assertConflict()->assertJsonPath('error', 'invoice_required')->assertJsonPath('procedure_ids', [$proc]);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->assertSignedOpen($visit);
        $this->as(self::KASIR)->postJson("/api/invoice-voids/$v/approve")->assertForbidden();
        $out = $this->as(self::OWNER)->postJson("/api/invoice-voids/$v/approve")->assertOk()->json();
        $this->assertSame(['void', 0, 1], [$out['status'], $out['balance_rp'], count($out['lines'])]); // lines stay
        $this->selesai($visit)->assertOk()->assertJsonPath('visit.status', 'selesai'); // approved void = handled
        $acc = $this->as(self::KASIR)->getJson('/api/payment-accounts')->json('0.id');
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/payments", ['payment_account_id' => $acc, 'amount_rp' => 1000])
            ->assertConflict()->assertJsonPath('error', 'invoice_void');
        $this->credit($inv, $out['lines'][0]['id'], 1000)->assertConflict();
        $this->assertTrue($this->audited('void.disetujui', $this->tenantA()));

        // with a payment: refused, use credit note + refund
        [, , $paid] = $this->billed();
        $this->as(self::KASIR)->postJson("/api/invoices/$paid/payments", ['payment_account_id' => $acc, 'amount_rp' => 1000])->assertCreated();
        $this->as(self::KASIR)->postJson("/api/invoices/$paid/void", ['reason' => 'Tagihan dobel dibuat'])->assertUnprocessable()
            ->assertJsonPath('error', 'has_payments');

        // no billed line (no tariff): kasir voids at once
        [, , $empty] = $this->billed(proc: ['tooth' => 21, 'procedure_code' => '23.41']);
        $this->as(self::KASIR)->postJson("/api/invoices/$empty/void", ['reason' => 'Tagihan kosong salah buat'])->assertCreated()
            ->assertJsonPath('status', 'void');
    }

    // #78 (Yohanes 16 Nov 2026): a Rp0 price set by the owner is free work, approved by setting it; the invoice is lunas at Rp0.
    public function test_zero_tariff_line_is_free_work_not_a_correction(): void
    {
        $this->in($this->tenantA(), fn () => Tariff::create(['procedure_code' => '23.01', 'name' => 'Cabut gigi susu (gratis contoh)',
            'variant' => 'gratis', 'level_label' => 'Gratis', 'price_rp' => 0, 'valid_from' => '2026-01-01']));
        [, , $inv] = $this->billed(proc: ['tooth' => 51, 'procedure_code' => '23.01', 'variant' => 'gratis']);
        $i = $this->invoice($inv);
        $this->assertSame([0, null, 'lunas', 0], [$i['lines'][0]['price_rp'], $i['lines'][0]['tariff_zero'], $i['status'], $i['balance_rp']]);
        $this->assertSame([[], []], [$i['credit_notes'], $i['adjustments']]); // not a correction
        $this->assertTrue($this->audited('tarif_nol', $this->tenantA()));
    }

    public function test_correction_adjustment_must_point_at_a_line(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0]['id'];
        $body = ['kind' => 'correction', 'amount_rp' => -10000, 'reason' => 'Selisih tarif'];
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", $body)->assertUnprocessable()->assertJsonValidationErrors('invoice_line_id');
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", $body + ['invoice_line_id' => $line])->assertCreated()
            ->assertJsonPath('adjustments.0.invoice_line_id', $line);
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/adjustments", ['kind' => 'discount', 'amount_rp' => 1000, 'reason' => 'Diskon',
            'invoice_line_id' => $line])->assertUnprocessable();
        $this->assertSame(1, $this->in($this->tenantA(), fn () => InvoiceAdjustment::count() - InvoiceAdjustment::whereNull('invoice_line_id')->count()));
    }

    public function test_reversal_documents_are_immutable_in_the_database(): void
    {
        [, , $inv] = $this->billed();
        $line = $this->invoice($inv)['lines'][0];
        $nk = $this->credit($inv, $line['id'], $line['price_rp'])->json('credit_note_id');
        $this->as(self::OWNER)->postJson("/api/credit-notes/$nk/reject", ['reason' => 'Tidak ada dasar'])->assertOk()->assertJsonPath('credit_notes.0.status', 'rejected');
        $this->as(self::KASIR)->postJson("/api/invoices/$inv/void", ['reason' => 'Tagihan dobel dibuat'])->assertStatus(202);
        $t = $this->tenantA()->id;
        foreach (['UPDATE credit_note SET amount_rp = 1 WHERE tenant_id = ?', 'DELETE FROM credit_note WHERE tenant_id = ?',
            'UPDATE billing_decision SET decision = \'approved\' WHERE tenant_id = ?', 'DELETE FROM billing_decision WHERE tenant_id = ?',
            'UPDATE invoice_void SET reason = \'x\' WHERE tenant_id = ?', 'DELETE FROM invoice_void WHERE tenant_id = ?'] as $sql) {
            try {
                DB::statement($sql, [$t]); // app user: no UPDATE/DELETE grant; the trigger stops even the admin
                $this->fail("allowed: $sql");
            } catch (QueryException $e) {
                $this->assertMatchesRegularExpression('/hanya boleh ditambah|command denied/', $e->getMessage());
            }
        }
    }
}
