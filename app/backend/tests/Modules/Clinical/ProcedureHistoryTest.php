<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Unit 3 (DEVIATIONS #49): append-only procedure history. Replace = `superseded` marker + new work (replaces_id);
// correction = new final row superseding the old one; chart ?as_of= = what was in force at the end of that local day.
class ProcedureHistoryTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const REASON = 'Tambalan bocor, karies sekunder.';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** Signed visit with a billed `selesai` MOD filling on 26. Returns [visit id, filling id, patient id]. */
    private function filling(): array
    {
        $appt = $this->inA(fn () => Appointment::where('branch_id', Membership::where('user_id', $this->user('depan@senyum.test')->id)->value('branch_id'))
            ->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail()); // front desk's branch, no visit yet
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();
        $id = $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 26, 'surfaces' => 'MOD', 'procedure_code' => '23.2',
            'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated()->json('id');
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        return [$visit, $id, $appt->patient_id];
    }

    private function lines(string $visit)
    {
        return $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get());
    }

    private function chart(string $patient, ?string $asOf = null, string $as = self::DOC)
    {
        return $this->as($as)->getJson("/api/patients/$patient/chart".($asOf === null ? '' : "?as_of=$asOf"));
    }

    private function crown(string $id, string $visit, array $body = [])
    {
        return $this->as(self::DOC)->postJson("/api/procedures/$id/replace", $body + ['visit_id' => $visit, 'status' => 'direncanakan',
            'tooth' => 26, 'procedure_code' => '23.41', 'reason' => self::REASON]);
    }

    private static function on26(array $rows): array
    {
        return collect($rows)->where('tooth', 26)->map(fn ($p) => $p['procedure_code'].':'.$p['status'])->values()->all();
    }

    public function test_replace_filling_with_planned_crown_keeps_both_rows_and_the_old_line_and_as_of_shows_each_period(): void
    {
        [$visit, $filling, $patient] = $this->filling();
        $line = $this->lines($visit)->sole();
        $today = now('Asia/Jakarta')->toDateString();

        $this->travel(3)->days();
        $r = $this->crown($filling, $visit)->assertCreated();
        $marker = $r->json('replaced');
        $crown = $r->json('procedure');
        $this->assertSame(['superseded', $filling, self::REASON, 'MOD'], [$marker['status'], $marker['supersedes_id'], $marker['reason'], $marker['surfaces']]);
        $this->assertSame(['direncanakan', $filling, self::REASON, 'Crown', 'final'], [$crown['status'], $crown['replaces_id'], $crown['reason'], $crown['paint_type'], $crown['state']]);

        // old row untouched, its invoice line untouched; a planned crown never bills
        $this->assertSame(['selesai', 'final', null], $this->inA(fn () => array_values(ProcedureRecord::findOrFail($filling)->only(['status', 'state', 'supersedes_id']))));
        $this->assertEquals($line->getAttributes(), $this->lines($visit)->sole()->getAttributes());

        $now = $this->chart($patient)->assertOk()->json();
        $this->assertSame(['23.41:direncanakan'], self::on26($now['procedures'])); // marker and old filling are not current paint
        $hist = collect($now['procedure_history'])->keyBy('id');
        $this->assertSame([$marker['id'], 'digantikan'], [$hist[$filling]['superseded_by'], $hist[$filling]['change']]);

        // as of the filling day: filling is current, no crown, nothing superseded; as of today (+3): the crown
        $past = $this->chart($patient, $today)->assertOk()->assertJsonPath('as_of', $today)->json();
        $this->assertSame(['23.2:selesai'], self::on26($past['procedures']));
        $this->assertNull(collect($past['procedure_history'])->firstWhere('id', $filling)['superseded_by']);
        $this->assertSame(['23.41:direncanakan'], self::on26($this->chart($patient, now('Asia/Jakarta')->toDateString())->json('procedures')));
        $this->assertSame(['23.41:direncanakan'], self::on26($this->chart($patient, '2099-01-01')->json('procedures'))); // future = current

        $this->crown($crown['id'], $visit)->assertConflict()->assertJsonPath('error', 'not_replaceable'); // a plan is not existing work
        $this->assertTrue($this->inA(fn () => AuditEvent::where('action', 'ganti_tindakan')->where('entity_id', $crown['id'])->exists()));
    }

    public function test_replace_is_refused_without_reason_on_wrong_site_patient_or_status_and_only_once(): void
    {
        [$visit, $filling] = $this->filling();
        $this->crown($filling, $visit, ['reason' => 'pendek'])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->crown($filling, $visit, ['reason' => null])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->crown($filling, $visit, ['status' => 'cancelled'])->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->crown($filling, $visit, ['tooth' => 27])->assertUnprocessable()->assertJsonValidationErrors('tooth');
        $this->crown($filling, $visit, ['tooth' => 26, 'surfaces' => 'B', 'procedure_code' => '23.2'])->assertUnprocessable(); // no shared surface
        $other = $this->inA(fn () => Visit::where('patient_id', '!=', Visit::findOrFail($visit)->patient_id)->firstOrFail()->id);
        $this->crown($filling, $other)->assertNotFound();
        $this->as('asisten@senyum.test')->postJson("/api/procedures/$filling/replace", ['visit_id' => $visit, 'status' => 'direncanakan',
            'tooth' => 26, 'procedure_code' => '23.41', 'reason' => self::REASON])->assertForbidden();

        // re-filling done today: bills on its own line, the old filling's line stays
        $refill = $this->crown($filling, $visit, ['status' => 'selesai', 'surfaces' => 'MOD', 'procedure_code' => '23.2'])->assertCreated()->json('procedure.id');
        $this->assertEqualsCanonicalizing([$filling, $refill], $this->lines($visit)->pluck('procedure_id')->all());
        $this->crown($filling, $visit)->assertConflict()->assertJsonPath('error', 'superseded');
        $this->as(self::DOC)->postJson("/api/procedures/$filling/status", ['to' => 'direncanakan'])->assertConflict();
        $this->assertSame(1, $this->inA(fn () => ProcedureRecord::where('status', 'superseded')->where('supersedes_id', $filling)->count()));
    }

    public function test_correction_is_a_new_row_old_stays_readable_never_bills_and_raw_update_is_still_refused(): void
    {
        [$visit, $filling, $patient] = $this->filling();
        $correct = fn (array $b) => $this->as(self::DOC)->postJson("/api/procedures/$filling/corrections", $b + ['reason_type' => 'salah_situs']);
        $correct(['diagnosis_code' => 'K02.2'])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $correct(['surfaces' => 'MO', 'status' => 'cancelled', 'reason' => self::REASON])->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->as('asisten@senyum.test')->postJson("/api/procedures/$filling/corrections", ['surfaces' => 'MO', 'reason' => self::REASON])->assertForbidden();

        $new = $correct(['surfaces' => 'MO', 'reason' => 'Salah catat permukaan, seharusnya MO.'])->assertCreated()
            ->assertJsonPath('supersedes_id', $filling)->assertJsonPath('surfaces', 'MO')->assertJsonPath('status', 'selesai')
            ->assertJsonPath('procedure_code', '23.2')->assertJsonPath('diagnosis_code', 'K02.1')->json('id');
        $this->assertSame('MOD', $this->inA(fn () => ProcedureRecord::findOrFail($filling)->surfaces));
        $this->assertSame([$filling], $this->lines($visit)->pluck('procedure_id')->all()); // no second line

        $chart = $this->chart($patient)->json();
        $this->assertSame([$new], collect($chart['procedures'])->where('tooth', 26)->pluck('id')->all());
        $old = collect($chart['procedure_history'])->firstWhere('id', $filling);
        $this->assertSame(['MOD', $new, 'koreksi'], [$old['surfaces'], $old['superseded_by'], $old['change']]);
        $correct(['surfaces' => 'O', 'reason' => self::REASON])->assertConflict()->assertJsonPath('error', 'superseded');
        $this->assertSame(['surfaces'], $this->inA(fn () => AuditEvent::where('action', 'koreksi_tindakan.diterapkan')->where('entity_id', $new)->sole()->detail['fields']));

        $this->inA(function () use ($new) {
            foreach (['surfaces' => 'O', 'reason' => 'diubah langsung', 'replaces_id' => $new] as $col => $val) {
                try {
                    DB::update("UPDATE procedure_record SET $col = ? WHERE tenant_id = ? AND id = ?", [$val, $this->tenantA()->id, $new]);
                    $this->fail("final $col updated");
                } catch (QueryException $e) {
                    $this->assertStringContainsString('tidak boleh diubah', $e->getMessage());
                }
            }
        });
    }

    public function test_pending_external_is_out_of_current_and_as_of_until_confirmed_and_cannot_be_replaced(): void
    {
        [$visit, , $patient] = $this->filling();
        $doc = $this->user(self::DOC)->id;
        $ext = $this->inA(fn () => ProcedureRecord::create(['patient_id' => $patient, 'visit_id' => $visit, 'treat_area' => 'tooth', 'tooth' => 36,
            'status' => 'ada_di_tempat_lain', 'procedure_code' => '23.41', 'provider_id' => $doc, 'state' => 'final', 'created_by' => $doc,
            'finalized_at' => now(), 'external_clinic_name' => 'Klinik Contoh Lain', 'external_date' => '2025-01-01',
            'external_date_precision' => 'year', 'external_confirmation' => 'pending']));
        $today = now('Asia/Jakarta')->toDateString();
        foreach ([null, $today] as $asOf) {
            $c = $this->chart($patient, $asOf)->json();
            $this->assertNull(collect($c['procedures'])->firstWhere('id', $ext->id));
            $this->assertNull(collect($c['procedure_history'])->firstWhere('id', $ext->id));
        }
        $this->assertSame([], $this->chart($patient, $today)->json('pending_externals'));
        $this->crown($ext->id, $visit, ['tooth' => 36])->assertConflict()->assertJsonPath('error', 'external_unconfirmed');

        $this->travel(1)->days();
        $this->as('depan@senyum.test')->postJson("/api/procedures/{$ext->id}/confirm-external", ['confirm' => true])->assertOk();
        $this->assertNull(collect($this->chart($patient, $today)->json('procedures'))->firstWhere('id', $ext->id)); // confirmed after that day
        $this->assertNotNull(collect($this->chart($patient)->json('procedures'))->firstWhere('id', $ext->id));
    }

    public function test_as_of_validation_permission_tenant_and_audit(): void
    {
        [$visit, $filling, $patient] = $this->filling();
        $this->chart($patient, '')->assertUnprocessable()->assertJsonValidationErrors('as_of');
        $this->chart($patient, '15-11-2026')->assertUnprocessable()->assertJsonValidationErrors('as_of');
        $this->chart($patient, '2026-02-30')->assertUnprocessable();
        $this->chart($patient, '2026-01-01', 'kasir@senyum.test')->assertForbidden();
        $this->chart($patient, '2026-01-01', 'dokter@ceria.test')->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/procedures/$filling/replace", ['visit_id' => $visit, 'status' => 'direncanakan',
            'tooth' => 26, 'procedure_code' => '23.41', 'reason' => self::REASON])->assertNotFound();
        $this->as('dokter@ceria.test')->postJson("/api/procedures/$filling/corrections", ['reason_type' => 'salah_situs', 'surfaces' => 'MO', 'reason' => self::REASON])->assertNotFound();

        $this->chart($patient, '2026-01-01', 'pemilik@senyum.test')->assertOk()->assertJsonPath('procedures', []);
        $audit = $this->inA(fn () => AuditEvent::where('action', 'baca')->where('entity_id', $patient)->latest('id')->firstOrFail());
        $this->assertSame('2026-01-01', $audit->detail['as_of']);
    }
}
