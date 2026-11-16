<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Tests\TestCase;

// A second `selesai` row with the same code on the same site in one visit would bill twice: 409 duplicate_procedure until the
// dentist confirms (confirm_duplicate), then it is recorded with duplicate_of in the audit (KlinikMe "Tambah Tindakan Baru").
class DuplicateProcedureTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function visit(): Visit
    {
        return $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
    }

    private function entry(Visit $v, array $b)
    {
        return $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", $b + ['tooth' => 36, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'status' => 'selesai']);
    }

    public function test_second_identical_entry_asks_then_records_with_duplicate_of(): void
    {
        $v = $this->visit();
        $first = $this->entry($v, [])->assertCreated()->json('id');
        $res = $this->entry($v, ['surfaces' => ['M', 'O']])->assertConflict()->assertJsonPath('error', 'duplicate_procedure')->assertJsonPath('existing_id', $first);
        $this->assertStringContainsString('di gigi 36 O pada kunjungan ini. Tambahkan lagi?', $res->json('message'));
        $this->assertSame(1, $this->inA(fn () => ProcedureRecord::where('visit_id', $v->id)->where('procedure_code', '23.2')->where('tooth', 36)->count()));

        $second = $this->entry($v, ['surfaces' => ['M', 'O'], 'confirm_duplicate' => true])->assertCreated()->json('id');
        $this->assertSame($first, $this->inA(fn () => AuditEvent::where('entity_id', $second)->where('action', 'buat')->firstOrFail()->detail['duplicate_of'] ?? null));
    }

    public function test_other_surfaces_planned_rows_and_conditions_are_not_duplicates(): void
    {
        $v = $this->visit();
        $this->entry($v, [])->assertCreated();
        $this->entry($v, ['surfaces' => ['D']])->assertCreated(); // 36 O then 36 D: two fillings, one invoice line (S2)
        $this->entry($v, ['tooth' => 37])->assertCreated();
        $this->entry($v, ['status' => 'rencana'])->assertCreated(); // never bills
        $this->entry($v, ['condition' => 'karies', 'status' => 'rencana'])->assertCreated();
        $this->entry($v, ['condition' => 'karies', 'status' => 'rencana'])->assertCreated(); // no code: a finding, not a procedure
    }

    public function test_discarded_or_superseded_rows_do_not_count(): void
    {
        $v = $this->visit();
        $draft = $this->entry($v, [])->assertCreated()->json('id');
        $this->as(self::DOC)->deleteJson("/api/procedures/$draft")->assertNoContent();
        $kept = $this->entry($v, [])->assertCreated()->json('id');
        $this->inA(fn () => ProcedureRecord::findOrFail($kept)->replicate()->fill(['status' => 'tidak_dikerjakan', 'supersedes_id' => $kept])->save());
        $this->entry($v, [])->assertCreated();
    }

    public function test_another_visit_is_not_a_duplicate(): void
    {
        $v = $this->visit();
        $this->inA(function () use ($v) {
            $old = Visit::create(['patient_id' => $v->patient_id, 'branch_id' => Chair::firstOrFail()->branch_id, 'dentist_id' => $v->dentist_id,
                'started_at' => now()->subDay(), 'status' => 'berlangsung']);
            DatabaseSeeder::procedure($old, 36, 'O', 'selesai', '23.2', null, 'draft', $this->user(self::DOC));
        });
        $this->entry($v, [])->assertCreated();
    }

    public function test_whole_mouth_procedure_twice_through_the_draft_endpoint(): void
    {
        $v = $this->visit();
        $kontrol = ['procedure_code' => '89.31', 'variant' => 'kontrol', 'status' => 'selesai'];
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", $kontrol)->assertCreated();
        $msg = $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", $kontrol)->assertConflict()->assertJsonPath('error', 'duplicate_procedure')->json('message');
        $this->assertStringEndsWith('sudah dicatat pada kunjungan ini. Tambahkan lagi?', $msg);
        $this->as(self::DOC)->postJson("/api/visits/{$v->id}/procedures", $kontrol + ['confirm_duplicate' => true])->assertCreated();
    }
}
