<?php

namespace Tests\Modules\Billing;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

// Unit 4 (DEVIATIONS #50): a visit with completed work closes only with an invoice line per procedure; the one exception is
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

    private function doneWork(string $visit, array $proc): void
    {
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", $proc + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
        Cache::flush();
        $this->as(self::DOC)->postJson("/api/visits/$visit/sign", ['revision' => 1, 'confirm' => true,
            'code' => app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET)])->assertOk();
    }

    private function move(string $appt, string $to)
    {
        return $this->as(self::DESK)->postJson("/api/appointments/$appt/transition", ['to' => $to]);
    }

    private function row(string $visit): Visit
    {
        return $this->inA(fn () => Visit::findOrFail($visit));
    }

    public function test_billed_work_closes_via_appointment_done_and_via_close(): void
    {
        [$visit, $appt] = $this->visit();
        $this->doneWork($visit, self::BILLED);
        $this->assertCount(1, $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get()));
        foreach (['checked_in', 'in_treatment', 'done'] as $to) {
            $this->move($appt, $to)->assertOk();
        }
        $v = $this->row($visit);
        $this->assertSame(['selesai', false], [$v->status, $v->closed_without_invoice]);
        $this->assertNotNull($v->ended_at);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'visit_closed');

        [$visit2] = $this->visit();
        $this->doneWork($visit2, self::BILLED);
        $this->as(self::DESK)->postJson("/api/visits/$visit2/close")->assertOk()->assertJsonPath('status', 'selesai');
    }

    public function test_unbilled_work_blocks_close_and_appointment_done_even_with_a_reason(): void
    {
        [$visit, $appt] = $this->visit();
        $this->doneWork($visit, self::NO_TARIFF);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close")->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Pasien minta tutup saja'])->assertConflict()
            ->assertJsonPath('error', 'invoice_required');
        $this->move($appt, 'checked_in')->assertOk();
        $this->move($appt, 'in_treatment')->assertOk();
        $this->move($appt, 'done')->assertConflict()->assertJsonPath('error', 'invoice_required');
        $this->assertSame('in_treatment', $this->inA(fn () => Appointment::findOrFail($appt)->status)); // not dismissed
        $this->assertSame('berlangsung', $this->row($visit)->status);
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tutup_ditolak')->where('entity_id', $visit)->exists()));

        // an unsigned `selesai` draft has no line yet: blocks too
        [$visit2] = $this->visit();
        $this->as(self::DOC)->postJson("/api/visits/$visit2/procedures", self::BILLED + ['status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
        $this->as(self::DESK)->postJson("/api/visits/$visit2/close")->assertConflict()->assertJsonPath('error', 'invoice_required');
    }

    public function test_cancelled_or_no_show_attendance_closes_without_invoice_only_with_a_reason(): void
    {
        foreach (['cancelled', 'no_show'] as $to) {
            [$visit, $appt] = $this->visit();
            $this->doneWork($visit, self::NO_TARIFF);
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

    public function test_exam_only_visit_closes_without_invoice(): void
    {
        [$visit] = $this->visit();
        $this->as(self::DOC)->postJson("/api/visits/$visit/close")->assertOk()->assertJsonPath('status', 'selesai')
            ->assertJsonPath('closed_without_invoice', false);
        $this->assertNotNull($this->row($visit)->ended_at);
    }

    public function test_walk_in_cancel_attendance_then_close_with_reason(): void
    {
        $visit = $this->walkIn();
        $this->doneWork($visit, self::NO_TARIFF);
        $this->as(self::DESK)->postJson("/api/visits/$visit/close", ['reason' => 'Mau tutup tanpa tagihan'])->assertConflict()
            ->assertJsonPath('error', 'invoice_required');
        $this->as('kasir@senyum.test')->postJson("/api/visits/$visit/cancel-attendance", ['reason' => 'Pasien pulang sebelum dilayani'])->assertForbidden();
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
