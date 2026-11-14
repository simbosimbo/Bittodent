<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class ProcedureStatusTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** Patient 0's visit today (from the appointment; draft note + draft findings incl. 11 tambalan selesai 23.2). */
    private function todayVisit(): Visit
    {
        return $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
    }

    public function test_transition_table(): void
    {
        $this->assertTrue(ProcedureStatus::canMove('direncanakan', 'selesai'));
        $this->assertTrue(ProcedureStatus::canMove('kondisi_pantau', 'direncanakan'));
        $this->assertTrue(ProcedureStatus::canMove('ada_di_tempat_lain', 'direncanakan'));
        $this->assertFalse(ProcedureStatus::canMove('selesai', 'direncanakan'));
        $this->assertFalse(ProcedureStatus::canMove('kondisi_pantau', 'selesai'));
        $this->assertFalse(ProcedureStatus::canMove('ada_di_klinik_ini', 'selesai'));
        $this->assertEqualsCanonicalizing(ProcedureStatus::ALL, array_keys(ProcedureStatus::TRANSITIONS));
    }

    public function test_draft_takes_any_status_separate_from_condition(): void
    {
        $v = $this->todayVisit();
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/findings", ['tooth' => 36, 'surface' => 'O', 'condition' => 'tambalan', 'status' => 'ada_di_tempat_lain'])
            ->assertCreated()->assertJsonPath('status', 'ada_di_tempat_lain')->assertJsonPath('condition', 'tambalan');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/findings", ['tooth' => 36, 'surface' => 'O', 'condition' => 'tambalan', 'status' => 'kacau'])
            ->assertUnprocessable();
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/findings", ['tooth' => 36, 'surface' => 'O', 'condition' => 'tambalan', 'procedure_code' => 'X1'])
            ->assertUnprocessable();
    }

    public function test_status_change_on_signed_item_is_a_new_superseding_row_and_bills_selesai(): void
    {
        $v = $this->todayVisit();
        $old = $this->inA(fn () => ToothFinding::where('tooth', 18)->where('state', 'final')->firstOrFail());
        $this->assertSame('direncanakan', $old->status);

        $this->as('asisten@senyum.test')->postJson("/api/findings/{$old->id}/status", ['to' => 'selesai'])->assertForbidden();
        $new = $this->as(self::DOC)->postJson("/api/findings/{$old->id}/status", ['to' => 'selesai', 'visit_id' => $v->id])
            ->assertCreated()->assertJsonPath('status', 'selesai')->assertJsonPath('supersedes_id', $old->id)->assertJsonPath('state', 'final')->json('id');

        $this->assertSame('direncanakan', $this->inA(fn () => $old->fresh()->status)); // original row untouched
        $chart = $this->as(self::DOC)->getJson("/api/patients/{$old->patient_id}/chart")->assertOk();
        $this->assertSame('selesai', collect($chart->json('findings'))->firstWhere('tooth', 18)['status']);

        // second change of the superseded row, and moving out of a final status, are refused
        $this->as(self::DOC)->postJson("/api/findings/{$old->id}/status", ['to' => 'dirujuk'])->assertConflict()->assertJsonPath('error', 'superseded');
        $this->as(self::DOC)->postJson("/api/findings/$new/status", ['to' => 'direncanakan'])->assertConflict()->assertJsonPath('error', 'invalid_transition');

        // Billing listened: invoice for today's visit with a price snapshot from the tariff (23.09 standar)
        $line = $this->inA(fn () => InvoiceLine::where('finding_id', $new)->firstOrFail());
        $this->assertSame([150000, '23.09'], [$line->price_rp, $line->procedure_code]);
        $this->assertSame($v->id, $this->inA(fn () => Invoice::findOrFail($line->invoice_id)->visit_id));
    }

    public function test_signing_bills_draft_items_with_status_selesai_once(): void
    {
        $v = $this->todayVisit();
        $code = app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET);
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/sign", ['revision' => 1, 'confirm' => true, 'code' => $code])->assertOk();

        $inv = $this->inA(fn () => Invoice::where('visit_id', $v->id)->firstOrFail());
        $lines = $this->inA(fn () => InvoiceLine::where('invoice_id', $inv->id)->get());
        $this->assertSame([['23.2', 11, 250000]], $lines->map(fn ($l) => [$l->procedure_code, $l->tooth, $l->price_rp])->all()); // 26 karies = no procedure
        // payer = guarantor; patient 0 pays for themself
        $this->assertSame($v->patient_id, $inv->payer_patient_id);
    }

    public function test_missing_tariff_creates_no_line_and_is_audited(): void
    {
        $v = $this->todayVisit();
        $f = $this->inA(fn () => ToothFinding::create(['patient_id' => $v->patient_id, 'visit_id' => $v->id, 'tooth' => 21, 'surface' => null,
            'condition' => 'mahkota', 'status' => 'direncanakan', 'procedure_code' => '23.41', 'state' => 'final', 'created_by' => $this->user(self::DOC)->id]));
        $new = $this->as(self::DOC)->postJson("/api/findings/{$f->id}/status", ['to' => 'selesai'])->assertCreated()->json('id');
        $this->assertFalse($this->inA(fn () => InvoiceLine::where('finding_id', $new)->exists()));
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tarif_tidak_ada')->exists()));
    }
}
