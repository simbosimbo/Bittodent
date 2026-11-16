<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Tests\TestCase;

// Unit 4 (DEVIATIONS #50): a visit with completed work closes only with an invoice line per procedure (#55: via the DPJP's Selesai); the one exception is
// cancelled attendance (appointment cancelled/no_show, walk-in cancel-attendance) with a reason. Rp0 adjustments wait for an owner.
class EncounterInvoiceGuardTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const DESK = 'depan@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private const BILLED = ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2'];

    private const NO_TARIFF = ['tooth' => 21, 'procedure_code' => '23.41']; // crown: no seeded tariff => tarif_tidak_ada, no line

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** Fresh appointment visit in the front desk's branch. @return array{0: string, 1: string} [visit id, appointment id] */
    private function visit(bool $note = true): array
    {
        $appt = $this->inA(function () {
            $branch = Membership::where('user_id', $this->user(self::DESK)->id)->value('branch_id');

            return Appointment::where('branch_id', $branch)->where('status', 'booked')->whereNotIn('patient_id', Visit::select('patient_id'))
                ->orderBy('starts_at')->firstOrFail();
        });
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        if ($note) {
            $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();
        }

        return [$visit, $appt->id];
    }

    private function walkIn(): string
    {
        $v = $this->inA(function () {
            $appt = Appointment::where('branch_id', Membership::where('user_id', $this->user(self::DESK)->id)->value('branch_id'))
                ->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail();

            return Visit::create(['patient_id' => $appt->patient_id, 'branch_id' => $appt->branch_id, 'dentist_id' => $appt->dentist_id,
                'appointment_id' => null, 'started_at' => now(), 'status' => 'berlangsung']);
        });
        $this->as(self::DOC)->putJson("/api/visits/{$v->id}/note", ['soap' => ['S' => 'Datang langsung.', 'O' => 'Periksa.']])->assertOk();

        return $v->id;
    }

    /** Draft `selesai` work (unsigned). */
    private function work(string $visit, array $proc): void
    {
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", $proc + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
    }

    private function selesai(string $visit)
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true]);
    }

    private function move(string $appt, string $to)
    {
        return $this->as(self::DESK)->postJson("/api/appointments/$appt/transition", ['to' => $to]);
    }

    private function row(string $visit): Visit
    {
        return $this->inA(fn () => Visit::findOrFail($visit));
    }

    private function lines(string $visit)
    {
        return $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get());
    }

    public function test_billed_work_closes_via_selesai_and_the_appointment_follows_to_done(): void
    {
        [$visit, $appt] = $this->visit();
        $this->work($visit, self::BILLED);
        $this->selesai($visit)->assertOk()->assertJsonPath('visit.status', 'selesai')->assertJsonPath('visit.closed_without_invoice', false);
        $this->assertCount(1, $this->lines($visit));
        $a = $this->inA(fn () => Appointment::findOrFail($appt));
        $this->assertSame('done', $a->status); // never checked in: Selesai still dismisses it, each stamp set once
        $this->assertNotNull($a->arrived_at);
        $this->assertNotNull($a->dismissed_at);
        $this->move($appt, 'done')->assertConflict();
        $v = $this->row($visit);
        $this->assertSame(['selesai', false], [$v->status, $v->closed_without_invoice]);
        $this->assertNotNull($v->ended_at);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'visit_closed');

        // unsigned clinical work: neither /close nor appointment done may close it; only the DPJP's Selesai
        [$visit2, $appt2] = $this->visit();
        $this->work($visit2, self::BILLED);
        $this->as(self::DESK)->postJson("/api/visits/$visit2/close")->assertConflict()->assertJsonPath('error', 'use_selesai');
        $this->as(self::DOC)->postJson("/api/visits/$visit2/close")->assertConflict()->assertJsonPath('error', 'use_selesai');
        $this->move($appt2, 'checked_in')->assertOk();
        $this->move($appt2, 'in_treatment')->assertOk();
        $this->move($appt2, 'done')->assertConflict()->assertJsonPath('error', 'use_selesai');
        $this->assertSame('in_treatment', $this->inA(fn () => Appointment::findOrFail($appt2)->status));
        $this->assertSame('berlangsung', $this->row($visit2)->status);
        $this->selesai($visit2)->assertOk();
        $this->assertSame('done', $this->inA(fn () => Appointment::findOrFail($appt2)->status));
    }

    public function test_unbilled_work_signs_but_selesai_cannot_close(): void
    {
        [$visit, $appt] = $this->visit();
        $this->work($visit, self::NO_TARIFF);
        $this->selesai($visit)->assertConflict()->assertJsonPath('error', 'invoice_required')->assertJsonPath('signed', true);
        // #55: the signature commits (note signed, work final), only the close is refused: visit open, no line, no `tutup`
        $this->assertSame('signed', $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->firstOrFail()->versions->first()->state));
        $this->assertSame(['final'], $this->inA(fn () => ProcedureRecord::where('visit_id', $visit)->pluck('state')->all()));
        $this->assertCount(0, $this->lines($visit));
        $this->assertSame('berlangsung', $this->row($visit)->status);
        $this->assertFalse($this->inA(fn () => AuditEvent::where('action', 'tutup')->where('entity_id', $visit)->exists()));
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tanda_tangan')->exists()));
        $this->assertFalse($this->inA(fn () => AuditEvent::where('action', 'tanda_tangan_ditolak')->where('detail->why', 'tutup')->exists()));

        // signed + open: nothing left to sign, so /close and appointment done reach the invoice guard (not use_selesai)
        $this->selesai($visit)->assertConflict()->assertJsonPath('error', 'invoice_required'); // close-only path, same guard
        $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Pasien minta tutup saja'])->assertConflict()
            ->assertJsonPath('error', 'invoice_required');
        $this->move($appt, 'checked_in')->assertOk();
        $this->move($appt, 'in_treatment')->assertOk();
        $this->move($appt, 'done')->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->assertSame('in_treatment', $this->inA(fn () => Appointment::findOrFail($appt)->status)); // not dismissed
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tutup_ditolak')->where('entity_id', $visit)->exists()));
        $this->assertSame('berlangsung', $this->row($visit)->status);
    }

    public function test_cancelled_or_no_show_attendance_closes_without_invoice_only_with_a_reason(): void
    {
        foreach (['cancelled', 'no_show'] as $to) {
            [$visit, $appt] = $this->visit();
            $this->work($visit, self::NO_TARIFF);
            $this->move($appt, $to)->assertOk();
            $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertUnprocessable()->assertJsonValidationErrors('reason');
            $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'pendek'])->assertUnprocessable();
            $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Pasien batal hadir, dicatat front desk'])->assertOk()
                ->assertJsonPath('closed_without_invoice', true);
            $v = $this->row($visit);
            $this->assertSame(['selesai', 'Pasien batal hadir, dicatat front desk'], [$v->status, $v->close_reason]);
            $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tutup')->where('entity_id', $visit)->exists()));
        }
    }

    // Audit P0-4: a finished visit always ends in billing. No completed work => refused; a check-up bills 89.31 Pemeriksaan gigi.
    public function test_visit_without_completed_work_is_refused_until_an_examination_is_added(): void
    {
        [$visit, $appt] = $this->visit(); // a draft note = clinical work: Selesai, not /close
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'use_selesai');
        $this->selesai($visit)->assertConflict()->assertJsonPath('error', 'no_billable_work')
            ->assertJsonPath('message', 'Belum ada tindakan selesai. Tambahkan Pemeriksaan gigi (Konsultasi atau Kontrol) dari Tindakan seluruh mulut, lalu tekan Selesai lagi.');
        $this->assertSame('draft', $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->firstOrFail()->versions->first()->state)); // nothing signed
        $this->assertSame('berlangsung', $this->row($visit)->status);
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tanda_tangan_ditolak')->where('detail->error', 'no_billable_work')->exists()));

        $this->work($visit, ['procedure_code' => '89.31', 'variant' => 'kontrol']);
        $this->selesai($visit)->assertOk()->assertJsonPath('visit.status', 'selesai')->assertJsonPath('visit.closed_without_invoice', false);
        $this->assertSame([[0, false]], $this->lines($visit)->map(fn ($l) => [$l->price_rp, (bool) $l->tariff_zero])->all());
        // Rp0 kontrol from the price list is free work (#78): no owner approval, the invoice is lunas at once
        $this->as(self::DESK)->getJson("/api/visits/$visit/invoice")->assertOk()->assertJsonPath('balance_rp', 0)
            ->assertJsonPath('status', 'lunas')->assertJsonPath('lines.0.tariff_zero', null);
        $this->assertSame('done', $this->inA(fn () => Appointment::findOrFail($appt)->status));

        [$konsul] = $this->visit();
        $this->work($konsul, ['procedure_code' => '89.31', 'variant' => 'standar']); // level 1 = Konsultasi
        $this->selesai($konsul)->assertOk();
        $this->assertSame([100000], $this->lines($konsul)->pluck('price_rp')->all());

        [$empty, $emptyAppt] = $this->visit(note: false); // nothing to sign: /close and appointment done reach the same refusal
        $this->as(self::DESK)->postJson("/api/visits/$empty/close")->assertConflict()->assertJsonPath('error', 'no_billable_work');
        $this->move($emptyAppt, 'checked_in')->assertOk();
        $this->move($emptyAppt, 'in_treatment')->assertOk();
        $this->move($emptyAppt, 'done')->assertConflict()->assertJsonPath('error', 'no_billable_work');
        $this->assertSame(['berlangsung', 'in_treatment'], [$this->row($empty)->status, $this->inA(fn () => Appointment::findOrFail($emptyAppt)->status)]);
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tutup_ditolak')->where('entity_id', $empty)
            ->where('detail->reason', 'no_billable_work')->exists()));

        $walkIn = $this->walkIn(); // cancelled attendance is the one way to close without an invoice
        $this->as(self::DESK)->postJson("/api/visits/$walkIn/cancel-attendance", ['reason' => 'Pasien pulang sebelum diperiksa'])->assertOk();
        $this->as(self::DESK)->postJson("/api/visits/$walkIn/close", ['reason' => 'Pasien pulang sebelum diperiksa'])->assertOk()
            ->assertJsonPath('status', 'selesai');
    }

    public function test_walk_in_cancel_attendance_then_close_with_reason(): void
    {
        $visit = $this->walkIn();
        $this->work($visit, self::NO_TARIFF);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Mau tutup tanpa tagihan'])->assertConflict()
            ->assertJsonPath('error', 'use_selesai');
        // kasir holds appointment.transition since DEVIATIONS #67 (booking management), so it may cancel attendance like front desk.
        $this->as(self::DESK)->postJson("/api/visits/$visit/cancel-attendance")->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->as(self::DESK)->postJson("/api/visits/$visit/cancel-attendance", ['reason' => 'Pasien pulang sebelum dilayani'])->assertOk();
        $this->as(self::DESK)->postJson("/api/visits/$visit/cancel-attendance", ['reason' => 'Pasien pulang sebelum dilayani'])->assertConflict();
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertUnprocessable();
        $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Kehadiran dibatalkan, tanpa tagihan'])->assertOk()
            ->assertJsonPath('closed_without_invoice', true);
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'batal_hadir')->where('entity_id', $visit)->exists()));

        [$apptVisit] = $this->visit(); // appointment visits cancel through the appointment status
        $this->as(self::DESK)->postJson("/api/visits/$apptVisit/cancel-attendance", ['reason' => 'Pasien pulang sebelum dilayani'])
            ->assertUnprocessable()->assertJsonPath('error', 'has_appointment');
    }

    private function seededInvoice(): Invoice
    {
        return $this->inA(fn () => Invoice::orderBy('created_at')->firstOrFail());
    }

    private function fullDiscount(string $invoice, string $as = self::DESK)
    {
        return $this->as($as)->postJson("/api/invoices/$invoice/adjustments", ['kind' => 'discount', 'amount_rp' => 225000, 'reason' => 'Diskon penuh uji']);
    }

    public function test_full_discount_waits_for_owner_and_only_owner_decides(): void
    {
        $inv = $this->seededInvoice()->id; // 250000 - 25000 = 225000
        $rejected = $this->fullDiscount($inv)->assertStatus(202)->assertJsonPath('balance_rp', 225000)
            ->assertJsonPath('adjustments.1.status', 'pending')->json('adjustments.1.id');
        foreach ([self::DOC, self::DESK, 'kasir@senyum.test', 'asisten@senyum.test'] as $who) {
            $this->as($who)->postJson("/api/invoice-adjustments/$rejected/approve")->assertForbidden();
        }
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$rejected/reject", ['reason' => 'Tidak ada dasar'])->assertOk()
            ->assertJsonPath('balance_rp', 225000)->assertJsonPath('adjustments.1.status', 'rejected');
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$rejected/approve")->assertConflict();

        $id = $this->fullDiscount($inv)->assertStatus(202)->json('adjustments.2.id');
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$id/approve")->assertOk()->assertJsonPath('balance_rp', 0)
            ->assertJsonPath('adjustments.2.status', 'approved')->assertJsonPath('adjustments.2.self_approved_sole_owner', false);
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$id/approve")->assertConflict()->assertJsonPath('error', 'not_pending');
        $applied = $this->as(self::DESK)->getJson("/api/invoices/$inv")->json('adjustments.0.id'); // a normal (applied) one
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$applied/approve")->assertConflict();
        foreach (['penyesuaian_menunggu', 'penyesuaian_ditolak', 'penyesuaian_disetujui'] as $a) {
            $this->assertTrue($this->inA(fn () => AuditEvent::where('action', $a)->where('entity_id', $inv)->exists()), $a);
        }
    }

    public function test_owner_dentist_cannot_approve_own_work_when_another_owner_exists(): void
    {
        $this->inA(fn () => Membership::create(['user_id' => $this->user(self::DOC)->id, 'role' => 'owner', 'branch_id' => null]));
        $inv = $this->seededInvoice();
        $this->assertSame($this->user(self::DOC)->id, $this->inA(fn () => Visit::findOrFail($inv->visit_id)->dentist_id));
        $id = $this->fullDiscount($inv->id)->assertStatus(202)->json('adjustments.1.id');
        $this->as(self::DOC)->postJson("/api/invoice-adjustments/$id/approve")->assertForbidden()->assertJsonPath('error', 'conflict_of_interest');
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$id/approve")->assertOk()->assertJsonPath('balance_rp', 0)
            ->assertJsonPath('adjustments.1.self_approved_sole_owner', false);
    }

    public function test_sole_owner_dentist_may_self_approve_and_it_is_flagged(): void
    {
        $b = $this->tenantB()->id;
        $inv = Ctx::runAs($b, fn () => Invoice::orderBy('created_at')->firstOrFail());
        $balance = $this->as('kasir@ceria.test')->getJson("/api/invoices/{$inv->id}")->assertOk()->json('balance_rp');
        $this->as('kasir@ceria.test')->postJson("/api/invoices/{$inv->id}/adjustments", ['kind' => 'write_off', 'amount_rp' => $balance,
            'reason' => 'Hapus penuh uji'])->assertStatus(202)->assertJsonPath('balance_rp', $balance);
        $id = Ctx::runAs($b, fn () => InvoiceAdjustment::where('invoice_id', $inv->id)->where('requires_approval', true)->value('id'));
        $this->as('kasir@ceria.test')->postJson("/api/invoice-adjustments/$id/approve")->assertForbidden();
        $this->as('dokter@ceria.test')->postJson("/api/invoice-adjustments/$id/approve")->assertOk()->assertJsonPath('balance_rp', 0);
        $this->assertTrue(Ctx::runAs($b, fn () => InvoiceAdjustmentDecision::where('adjustment_id', $id)->value('self_approved_sole_owner')));
        $this->assertThrows(fn () => Ctx::runAs($b, fn () => InvoiceAdjustmentDecision::where('adjustment_id', $id)->update(['reason' => 'ubah'])),
            QueryException::class); // decisions are append-only

        // tenant isolation: tenant A cannot see or decide tenant B's adjustment, nor close tenant B's visits
        $this->as(self::OWNER)->postJson("/api/invoice-adjustments/$id/reject")->assertNotFound();
        $visitB = Ctx::runAs($b, fn () => Visit::where('status', 'berlangsung')->value('id') ?? Visit::value('id'));
        $this->as(self::DESK)->postJson("/api/visits/$visitB/close")->assertNotFound();
    }
}
