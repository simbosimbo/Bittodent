<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Events\ProcedureCorrected;
use App\Modules\Clinical\Models\ProcedureCorrection;
use App\Modules\Clinical\Models\ProcedureCorrectionDecision;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

// Unit A koreksi (DEVIATIONS #53): procedure corrections with a per-clinic window anchored on finalized_at, `tidak_dikerjakan`,
// owner approval outside the window, and never an invoice_line (no Rp0 line, no new line at all).
class ProcedureCorrectionTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const OWNER = 'pemilik@senyum.test';

    private const REASON = 'Salah input kode saat pencatatan.';

    private function in(Tenant $t, callable $fn): mixed
    {
        return Ctx::runAs($t->id, $fn);
    }

    /** Signed visit with a billed `selesai` MOD filling on 26 by $doc. Returns [visit id, filling id, patient id]. */
    private function filling(string $doc = self::DOC): array
    {
        $tenant = $doc === self::DOC ? $this->tenantA() : $this->tenantB();
        $appt = $this->in($tenant, fn () => Appointment::where('dentist_id', $this->user($doc)->id)
            ->when($doc === self::DOC, fn ($q) => $q->where('branch_id', Membership::where('user_id', $this->user('depan@senyum.test')->id)->value('branch_id')))
            ->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail());
        $visit = $this->as($doc)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();
        $id = $this->as($doc)->postJson("/api/visits/$visit/procedures", ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated()->json('id');
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        return [$visit, $id, $appt->patient_id];
    }

    private function correct(string $id, array $body, string $as = self::DOC)
    {
        return $this->as($as)->postJson("/api/procedures/$id/corrections", $body + ['reason' => self::REASON]);
    }

    private function lines(Tenant $t)
    {
        return $this->in($t, fn () => InvoiceLine::orderBy('id')->get(['id', 'procedure_id', 'price_rp'])->toArray());
    }

    private function audits(string $action): int
    {
        return $this->in($this->tenantA(), fn () => AuditEvent::where('action', $action)->count());
    }

    private function setWindow(int $hours): void
    {
        $this->as(self::OWNER)->putJson('/api/settings/clinic', ['correction_window_hours' => $hours])->assertOk()
            ->assertJsonPath('correction_window_hours', $hours);
    }

    public function test_code_correction_within_window_adds_a_row_keeps_history_and_creates_no_invoice_line(): void
    {
        Event::fake([ProcedureCorrected::class]);
        [, $filling, $patient] = $this->filling();
        $lines = $this->lines($this->tenantA());
        $day = now('Asia/Jakarta')->toDateString();

        $this->travel(47)->hours(); // default window 48h from finalized_at
        $r = $this->correct($filling, ['reason_type' => 'salah_kode', 'procedure_code' => '23.3'])->assertCreated()
            ->assertJsonPath('approval', 'not_needed')->assertJsonPath('supersedes_id', $filling)
            ->assertJsonPath('procedure_code', '23.3')->assertJsonPath('status', 'selesai')->assertJsonPath('surfaces', 'MOD');
        $new = $r->json('id');

        // billing untouched: same lines (so no new Rp0 line), none for the new row
        $this->assertSame($lines, $this->lines($this->tenantA()));
        $this->assertFalse($this->in($this->tenantA(), fn () => InvoiceLine::where('procedure_id', $new)->exists()));
        Event::assertDispatched(ProcedureCorrected::class, fn ($e) => [$e->oldProcedureId, $e->newProcedureId, $e->reasonType, $e->correctionId]
            === [$filling, $new, 'salah_kode', $r->json('correction_id')]);

        // old row readable in history and in force on the as_of day
        $this->assertSame(['23.2', 'selesai'], $this->in($this->tenantA(), fn () => array_values(ProcedureRecord::findOrFail($filling)->only(['procedure_code', 'status']))));
        $chart = $this->as(self::DOC)->getJson("/api/patients/$patient/chart")->json();
        $this->assertSame([$new], collect($chart['procedures'])->where('tooth', 26)->pluck('id')->all());
        $old = collect($chart['procedure_history'])->firstWhere('id', $filling);
        $this->assertSame(['23.2', $new, 'koreksi'], [$old['procedure_code'], $old['superseded_by'], $old['change']]);
        $past = $this->as(self::DOC)->getJson("/api/patients/$patient/chart?as_of=$day")->json('procedures');
        $this->assertSame([$filling], collect($past)->where('tooth', 26)->pluck('id')->all());

        $c = $this->in($this->tenantA(), fn () => ProcedureCorrection::with('decision')->sole());
        $this->assertSame([true, 'diterapkan', $new, self::REASON], [$c->within_window, $c->decision->decision, $c->decision->result_procedure_id, $c->reason()]);
        $this->assertNotSame(self::REASON, $this->in($this->tenantA(), fn () => DB::table('procedure_correction')->value('reason_enc'))); // encrypted at rest
        $this->assertSame([1, 1], [$this->audits('koreksi_tindakan.diajukan'), $this->audits('koreksi_tindakan.diterapkan')]);
    }

    public function test_tidak_dikerjakan_only_through_correction_and_not_drawn_on_the_current_chart(): void
    {
        [, $filling, $patient] = $this->filling();
        $lines = $this->lines($this->tenantA());
        $this->as(self::DOC)->postJson("/api/procedures/$filling/status", ['to' => 'tidak_dikerjakan'])->assertUnprocessable()->assertJsonValidationErrors('to');
        $this->as(self::DOC)->postJson("/api/visits/{$this->in($this->tenantA(), fn () => ProcedureRecord::findOrFail($filling)->visit_id)}/procedures",
            ['tooth' => 11, 'status' => 'tidak_dikerjakan'])->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->correct($filling, ['reason_type' => 'tidak_dikerjakan', 'surfaces' => 'MO'])->assertUnprocessable()->assertJsonValidationErrors('surfaces');

        $new = $this->correct($filling, ['reason_type' => 'tidak_dikerjakan'])->assertCreated()
            ->assertJsonPath('status', 'tidak_dikerjakan')->assertJsonPath('procedure_code', '23.2')->assertJsonPath('supersedes_id', $filling)->json('id');
        $this->assertSame($lines, $this->lines($this->tenantA()));

        $chart = $this->as(self::DOC)->getJson("/api/patients/$patient/chart")->json();
        $this->assertSame([], collect($chart['procedures'])->where('tooth', 26)->values()->all());
        $this->assertEqualsCanonicalizing([$filling, $new], collect($chart['procedure_history'])->where('tooth', 26)->pluck('id')->all());
        $this->correct($new, ['reason_type' => 'salah_situs', 'surfaces' => 'MO'])->assertConflict()->assertJsonPath('error', 'not_correctable');
        $this->as(self::DOC)->postJson("/api/procedures/$new/status", ['to' => 'selesai'])->assertConflict();
    }

    public function test_window_is_per_clinic_and_owner_only_audited_setting(): void
    {
        $this->as(self::OWNER)->getJson('/api/settings/clinic')->assertOk()->assertJsonPath('correction_window_hours', 48);
        $this->as(self::DOC)->getJson('/api/settings/clinic')->assertForbidden();
        $this->as(self::DOC)->putJson('/api/settings/clinic', ['correction_window_hours' => 72])->assertForbidden();
        foreach ([0, 721, 'x', null] as $bad) {
            $this->as(self::OWNER)->putJson('/api/settings/clinic', ['correction_window_hours' => $bad])->assertUnprocessable();
        }
        [, $filling] = $this->filling();
        $this->setWindow(24);
        $this->travel(30)->hours();

        $id = $this->correct($filling, ['reason_type' => 'salah_situs', 'surfaces' => 'MO'])->assertStatus(202)
            ->assertJsonPath('approval', 'pending')->assertJsonPath('window_hours', 24)->json('correction_id');
        $this->assertFalse($this->in($this->tenantA(), fn () => ProcedureRecord::where('supersedes_id', $filling)->exists()));
        $this->correct($filling, ['reason_type' => 'salah_situs', 'surfaces' => 'O'])->assertConflict()->assertJsonPath('error', 'correction_pending');

        // reject leaves the record untouched
        $this->as(self::OWNER)->postJson("/api/procedure-corrections/$id/reject", ['reason' => 'Perlu dicek ulang.'])->assertOk()
            ->assertJsonPath('decision', 'ditolak')->assertJsonPath('procedure', null);
        $this->assertFalse($this->in($this->tenantA(), fn () => ProcedureRecord::where('supersedes_id', $filling)->exists()));
        $this->as(self::OWNER)->postJson("/api/procedure-corrections/$id/approve")->assertConflict()->assertJsonPath('error', 'not_pending');

        $this->setWindow(72); // same 30h now applies directly; tenant B keeps its own default
        $this->correct($filling, ['reason_type' => 'salah_situs', 'surfaces' => 'MO'])->assertCreated()->assertJsonPath('surfaces', 'MO');
        $this->assertSame(48, (int) $this->tenantB()->fresh()->correction_window_hours);
        $this->as('dokter@ceria.test')->getJson('/api/settings/clinic')->assertOk()->assertJsonPath('correction_window_hours', 48);

        $audit = $this->in($this->tenantA(), fn () => AuditEvent::where('action', 'ubah_pengaturan')->orderBy('id')->get()->pluck('detail')->all());
        $this->assertSame([[48, 24], [24, 72]], array_map(fn ($d) => [$d['from'], $d['to']], $audit));
        $this->assertSame(1, $this->audits('koreksi_tindakan.ditolak'));
    }

    public function test_after_default_window_owner_approves_with_permission_tenant_and_conflict_checks(): void
    {
        [$visit, $filling, $patient] = $this->filling();
        $lines = $this->lines($this->tenantA());
        $this->travel(49)->hours();
        $this->correct($filling, ['reason_type' => 'salah_kode', 'procedure_code' => '23.3'], 'asisten@senyum.test')->assertForbidden(); // no note.sign
        $id = $this->correct($filling, ['reason_type' => 'salah_kode', 'procedure_code' => '23.3'])->assertStatus(202)->json('correction_id');

        $this->as(self::DOC)->postJson("/api/procedure-corrections/$id/approve")->assertForbidden();
        $this->as('kasir@senyum.test')->getJson('/api/procedure-corrections/pending')->assertForbidden();
        $this->as('dokter@ceria.test')->postJson("/api/procedure-corrections/$id/approve")->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/procedure-corrections/$id/reject")->assertNotFound();
        $this->as('dokter@ceria.test')->getJson('/api/procedure-corrections/pending')->assertOk()->assertJsonCount(0);
        $this->as(self::OWNER)->getJson('/api/procedure-corrections/pending')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $id)->assertJsonPath('0.reason', self::REASON)->assertJsonPath('0.reason_type', 'salah_kode')
            ->assertJsonPath('0.proposed.procedure_code', '23.3')->assertJsonPath('0.procedure.id', $filling);

        // a dentist who is also an owner may not approve their own correction while another owner exists
        $this->in($this->tenantA(), fn () => Membership::create(['user_id' => $this->user(self::DOC)->id, 'role' => 'owner']));
        $this->as(self::DOC)->postJson("/api/procedure-corrections/$id/approve")->assertForbidden()->assertJsonPath('error', 'conflict_of_interest');

        $new = $this->as(self::OWNER)->postJson("/api/procedure-corrections/$id/approve")->assertOk()->assertJsonPath('decision', 'disetujui')
            ->assertJsonPath('self_approved_sole_owner', false)->assertJsonPath('procedure.procedure_code', '23.3')
            ->assertJsonPath('procedure.supersedes_id', $filling)->json('procedure.id');
        $this->assertSame($this->user(self::DOC)->id, $this->in($this->tenantA(), fn () => ProcedureRecord::findOrFail($new)->created_by));
        $this->assertSame($lines, $this->lines($this->tenantA()));
        $this->assertSame([$new], collect($this->as(self::DOC)->getJson("/api/patients/$patient/chart")->json('procedures'))->where('tooth', 26)->pluck('id')->all());
        $this->as(self::OWNER)->getJson('/api/procedure-corrections/pending')->assertJsonCount(0);
        $this->assertSame([1, 1, 1], [$this->audits('koreksi_tindakan.disetujui'), $this->audits('koreksi_tindakan.diterapkan'), $this->audits('koreksi_tindakan.konflik')]);
        $this->as('dokter@ceria.test')->postJson("/api/procedures/$new/corrections", ['reason_type' => 'salah_situs', 'surfaces' => 'MO', 'reason' => self::REASON])->assertNotFound();
    }

    public function test_sole_owner_dentist_self_approval_is_flagged(): void
    {
        [, $filling] = $this->filling('dokter@ceria.test');
        $this->travel(3)->days();
        $id = $this->correct($filling, ['reason_type' => 'tidak_dikerjakan'], 'dokter@ceria.test')->assertStatus(202)->json('correction_id');
        $this->as('dokter@ceria.test')->postJson("/api/procedure-corrections/$id/approve")->assertOk()
            ->assertJsonPath('self_approved_sole_owner', true)->assertJsonPath('procedure.status', 'tidak_dikerjakan');
        $this->assertTrue($this->in($this->tenantB(), fn () => ProcedureCorrectionDecision::where('correction_id', $id)->sole()->self_approved_sole_owner));
    }

    public function test_reason_and_reason_type_required_and_correction_rows_are_append_only(): void
    {
        [, $filling] = $this->filling();
        $this->as(self::DOC)->postJson("/api/procedures/$filling/corrections", ['surfaces' => 'MO', 'reason' => self::REASON])
            ->assertUnprocessable()->assertJsonValidationErrors('reason_type');
        $this->as(self::DOC)->postJson("/api/procedures/$filling/corrections", ['surfaces' => 'MO', 'reason_type' => 'lain'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason_type', 'reason']);
        $this->correct($filling, ['reason_type' => 'salah_situs', 'surfaces' => 'MO', 'reason' => 'pendek'])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->correct($filling, ['reason_type' => 'salah_situs', 'surfaces' => 'MO'])->assertCreated();

        $t = $this->tenantA()->id;
        foreach (['UPDATE procedure_correction SET reason_type = ? WHERE tenant_id = ?' => ['tidak_dikerjakan', $t],
            'DELETE FROM procedure_correction WHERE tenant_id = ? AND reason_type <> ?' => [$t, 'x'],
            'UPDATE procedure_correction_decision SET decision = ? WHERE tenant_id = ?' => ['ditolak', $t],
            'DELETE FROM procedure_correction_decision WHERE tenant_id = ? AND decision <> ?' => [$t, 'x']] as $sql => $args) {
            try {
                DB::statement($sql, $args);
                $this->fail("allowed: $sql");
            } catch (QueryException $e) {
                $this->assertMatchesRegularExpression('/hanya boleh ditambah|command denied/', $e->getMessage());
            }
        }
    }
}
