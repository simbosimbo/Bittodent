<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Patients\Models\Patient;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class ProcedureStatusTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** Patient 0's visit today (from the appointment; draft note + draft procedure 11 I selesai 23.2 + draft finding 26 karies). */
    private function todayVisit(): Visit
    {
        return $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
    }

    private function finalProcedure(Visit $v, array $attrs): ProcedureRecord
    {
        return $this->inA(fn () => ProcedureRecord::create($attrs + ['patient_id' => $v->patient_id, 'visit_id' => $v->id, 'treat_area' => 'tooth',
            'provider_id' => $v->dentist_id, 'state' => 'final', 'created_by' => $this->user(self::DOC)->id, 'finalized_at' => now()]));
    }

    public function test_transition_table(): void
    {
        $this->assertTrue(ProcedureStatus::canMove('direncanakan', 'selesai'));
        $this->assertTrue(ProcedureStatus::canMove('kondisi_pantau', 'direncanakan'));
        $this->assertTrue(ProcedureStatus::canMove('ada_di_tempat_lain', 'direncanakan'));
        $this->assertTrue(ProcedureStatus::canMove('direncanakan', 'cancelled'));
        $this->assertFalse(ProcedureStatus::canMove('selesai', 'direncanakan'));
        $this->assertFalse(ProcedureStatus::canMove('selesai', 'superseded')); // supersede = later unit, never a status patch
        $this->assertFalse(ProcedureStatus::canMove('cancelled', 'selesai'));
        $this->assertFalse(ProcedureStatus::canMove('kondisi_pantau', 'selesai'));
        $this->assertFalse(ProcedureStatus::canMove('ada_di_klinik_ini', 'selesai'));
        $this->assertEqualsCanonicalizing(ProcedureStatus::ALL, array_keys(ProcedureStatus::TRANSITIONS));
        $this->assertNotContains('superseded', ProcedureStatus::WRITABLE);
        $this->assertSame('ada_di_tempat_lain', ProcedureStatus::normalize('external'));
    }

    public function test_draft_takes_any_writable_status_and_external_alias(): void
    {
        $v = $this->todayVisit();
        $post = fn (string $status) => $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", ['tooth' => 36, 'surfaces' => 'O', 'procedure_code' => '23.2', 'status' => $status]);
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", ['tooth' => 36, 'surfaces' => 'O', 'procedure_code' => '23.2', 'status' => 'external',
            'external_clinic_name' => 'Klinik Contoh Lain', 'external_date' => '2025'])->assertCreated()->assertJsonPath('status', 'ada_di_tempat_lain');
        $post('ada_di_klinik_ini')->assertCreated()->assertJsonPath('status', 'ada_di_klinik_ini');
        $post('kacau')->assertUnprocessable()->assertJsonValidationErrors('status');
        $post('superseded')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", ['tooth' => 36, 'surfaces' => 'O', 'status' => 'direncanakan', 'procedure_code' => 'X1'])
            ->assertUnprocessable()->assertJsonValidationErrors('procedure_code');
    }

    public function test_status_change_on_signed_item_is_a_new_superseding_row_and_bills_selesai(): void
    {
        $v = $this->todayVisit();
        $old = $this->inA(fn () => ProcedureRecord::where('tooth', 18)->where('state', 'final')->firstOrFail());
        $this->assertSame('direncanakan', $old->status);
        $patient = fn () => $this->inA(fn () => Patient::findOrFail($old->patient_id));
        $this->assertTrue($patient()->care_unfinished_procedure); // seeded: 18 direncanakan

        $this->as('asisten@senyum.test')->postJson("/api/procedures/{$old->id}/status", ['to' => 'selesai'])->assertForbidden();
        $this->as('pemilik@senyum.test')->postJson("/api/procedures/{$old->id}/status", ['to' => 'selesai'])->assertForbidden(); // owner: clinical read-only
        $new = $this->as(self::DOC)->postJson("/api/procedures/{$old->id}/status", ['to' => 'selesai', 'visit_id' => $v->id])
            ->assertCreated()->assertJsonPath('status', 'selesai')->assertJsonPath('supersedes_id', $old->id)->assertJsonPath('state', 'final')->json('id');

        $this->assertSame('direncanakan', $this->inA(fn () => $old->fresh()->status)); // original row untouched
        $this->assertFalse($patient()->care_unfinished_procedure); // Clinical pushed the new fact to Patients
        $chart = $this->as(self::DOC)->getJson("/api/patients/{$old->patient_id}/chart")->assertOk();
        $this->assertSame(['selesai'], collect($chart->json('procedures'))->where('tooth', 18)->pluck('status')->all());

        // second change of the superseded row, and moving out of a final status, are refused
        $this->as(self::DOC)->postJson("/api/procedures/{$old->id}/status", ['to' => 'dirujuk'])->assertConflict()->assertJsonPath('error', 'superseded');
        $this->as(self::DOC)->postJson("/api/procedures/$new/status", ['to' => 'direncanakan'])->assertConflict()->assertJsonPath('error', 'invalid_transition');

        // Billing listened: invoice for today's visit with a price snapshot from the tariff (23.09 standar)
        $line = $this->inA(fn () => InvoiceLine::where('procedure_id', $new)->firstOrFail());
        $this->assertSame([150000, '23.09'], [$line->price_rp, $line->procedure_code]);
        $this->assertSame($v->id, $this->inA(fn () => Invoice::findOrFail($line->invoice_id)->visit_id));
    }

    public function test_signing_bills_draft_items_with_status_selesai_once(): void
    {
        $v = $this->todayVisit();
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/selesai", ['revision' => 1, 'confirm' => true])->assertUnprocessable()
            ->assertJsonPath('error', 'unapproved_drafts'); // seeded agent finding (26 karies)
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/approve-drafts")->assertOk();
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        $inv = $this->inA(fn () => Invoice::where('visit_id', $v->id)->firstOrFail());
        $lines = $this->inA(fn () => InvoiceLine::where('invoice_id', $inv->id)->get());
        $this->assertSame([['23.2', 11, 250000]], $lines->map(fn ($l) => [$l->procedure_code, $l->tooth, $l->price_rp])->all()); // 26 karies = finding, no bill
        // payer = guarantor; patient 0 pays for themself
        $this->assertSame($v->patient_id, $inv->payer_patient_id);
    }

    public function test_missing_tariff_creates_no_line_and_is_audited(): void
    {
        $f = $this->finalProcedure($this->todayVisit(), ['tooth' => 21, 'status' => 'direncanakan', 'procedure_code' => '23.41']);
        $new = $this->as(self::DOC)->postJson("/api/procedures/{$f->id}/status", ['to' => 'selesai'])->assertCreated()->json('id');
        $this->assertFalse($this->inA(fn () => InvoiceLine::where('procedure_id', $new)->exists()));
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'tarif_tidak_ada')->exists()));
    }

    public function test_status_change_copies_diagnosis_and_surfaces_to_new_final_row(): void
    {
        $f = $this->finalProcedure($this->todayVisit(), ['tooth' => 46, 'treat_area' => 'surface', 'surfaces' => 'MOD', 'status' => 'direncanakan',
            'procedure_code' => '23.2', 'diagnosis_code' => 'K02.1', 'diagnosis_source' => 'aturan']);
        $this->as(self::DOC)->postJson("/api/procedures/{$f->id}/status", ['to' => 'selesai'])->assertCreated()
            ->assertJsonPath('supersedes_id', $f->id)->assertJsonPath('diagnosis_code', 'K02.1')->assertJsonPath('diagnosis_source', 'aturan')
            ->assertJsonPath('surfaces', 'MOD');
    }

    public function test_cancelled_and_non_selesai_moves_never_bill(): void
    {
        $v = $this->todayVisit();
        foreach (['cancelled', 'dirujuk', 'kondisi_pantau'] as $to) {
            $f = $this->finalProcedure($v, ['tooth' => 21, 'status' => 'direncanakan', 'procedure_code' => '23.09']);
            $this->as(self::DOC)->postJson("/api/procedures/{$f->id}/status", ['to' => $to])->assertCreated()->assertJsonPath('status', $to);
        }
        $this->assertSame(0, $this->inA(fn () => InvoiceLine::where('procedure_code', '23.09')->where('tooth', 21)->count()));
    }
}
