<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\ApproxDate;
use App\Modules\Clinical\Domain\ProcedureSite;
use App\Modules\Clinical\Http\Controllers\ProcedureController;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Tests\TestCase;

// Unit 2 (DEVIATIONS #48): status external = work at another clinic. Clinic + approximate date, never billed; same site as today's
// `selesai` = 422; other site on a day with `selesai` work = pending until front desk / assistant confirms.
class ProcedureExternalTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const EXT = ['status' => 'external', 'external_clinic_name' => 'Klinik Contoh Lain', 'external_date' => '06/2025'];

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** A fresh visit in the front desk's branch for a patient with no other visit today (patient 0 has today's seeded visit). */
    private function visit(): string
    {
        $appt = $this->inA(function () {
            $branch = Membership::where('user_id', $this->user('depan@senyum.test')->id)->value('branch_id');

            return Appointment::where('branch_id', $branch)->whereNotIn('patient_id', Visit::select('patient_id'))->orderBy('starts_at')->firstOrFail();
        });
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();

        return $visit;
    }

    private function proc(string $visit, array $body)
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", $body + ['status' => 'selesai', 'diagnosis_code' => 'K02.1']);
    }

    private function sign(string $visit)
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true]);
    }

    private function lines(string $visit)
    {
        return $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get());
    }

    private function confirm(string $id, string $as, bool $yes = true, ?string $reason = null)
    {
        return $this->as($as)->postJson("/api/procedures/$id/confirm-external", ['confirm' => $yes, 'reason' => $reason]);
    }

    private function chart(string $visit): array
    {
        return $this->as(self::DOC)->getJson('/api/patients/'.$this->inA(fn () => Visit::findOrFail($visit)->patient_id).'/chart')->assertOk()->json();
    }

    public function test_external_needs_clinic_and_date_is_active_without_selesai_today_and_never_bills(): void
    {
        $visit = $this->visit();
        $base = ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2'];
        $this->proc($visit, ['external_clinic_name' => '  '] + $base + self::EXT)
            ->assertUnprocessable()->assertJsonValidationErrors('external_clinic_name');
        $this->proc($visit, $base + ['external_date' => null] + self::EXT)->assertUnprocessable()->assertJsonValidationErrors('external_date');
        $this->proc($visit, $base + ['external_date' => '2025-02-30'] + self::EXT)->assertUnprocessable()->assertJsonValidationErrors('external_date');
        $tomorrow = CarbonImmutable::now('Asia/Jakarta')->addDay()->format('d/m/Y');
        $this->proc($visit, $base + ['external_date' => $tomorrow] + self::EXT)->assertUnprocessable()->assertJsonValidationErrors('external_date');
        // the fields belong to external only
        $this->proc($visit, ['tooth' => 17, 'surfaces' => 'O', 'procedure_code' => '23.2', 'external_clinic_name' => 'Klinik Contoh Lain'])
            ->assertUnprocessable()->assertJsonValidationErrors('external_clinic_name');
        $this->proc($visit, ['tooth' => 17, 'surfaces' => 'O', 'procedure_code' => '23.2', 'status' => 'direncanakan', 'external_date' => '2025'])
            ->assertUnprocessable()->assertJsonValidationErrors('external_date');

        $id = $this->proc($visit, $base + self::EXT)->assertCreated()->assertJsonPath('status', 'ada_di_tempat_lain')
            ->assertJsonPath('external_clinic_name', 'Klinik Contoh Lain')->assertJsonPath('external_date', '2025-06-01')
            ->assertJsonPath('external_date_precision', 'month')->assertJsonPath('external_confirmation', 'not_required')->json('id');
        // PATCH keeps unsent external fields; a full date switches precision
        $this->as(self::DOC)->patchJson("/api/procedures/$id", ['external_date' => '12/06/2025'])->assertOk()
            ->assertJsonPath('external_date', '2025-06-12')->assertJsonPath('external_date_precision', 'day')
            ->assertJsonPath('external_clinic_name', 'Klinik Contoh Lain');
        $this->as(self::DOC)->patchJson("/api/procedures/$id", ['status' => 'direncanakan'])->assertOk()
            ->assertJsonPath('external_clinic_name', null)->assertJsonPath('external_date', null)->assertJsonPath('external_confirmation', null);
        $this->as(self::DOC)->patchJson("/api/procedures/$id", self::EXT)->assertOk()->assertJsonPath('external_date_precision', 'month');

        $this->proc($visit, ['procedure_code' => '89.31', 'variant' => 'kontrol'])->assertCreated(); // P0-4: Selesai needs a billable act
        $this->sign($visit)->assertOk();
        $this->inA(fn () => ProcedureController::recorded(ProcedureRecord::findOrFail($id))); // even re-raised after sign: nothing
        $this->assertNotContains($id, $this->lines($visit)->pluck('procedure_id')->all());
        $this->assertContains($id, array_column($this->chart($visit)['procedures'], 'id'));
        $audit = $this->inA(fn () => AuditEvent::where('entity_id', $id)->where('action', 'buat')->sole());
        $this->assertSame(['Klinik Contoh Lain', 'month'], [$audit->detail['external_clinic_name'], $audit->detail['external_date_precision']]);
        $this->assertArrayNotHasKey('price_rp', $audit->detail);
    }

    public function test_approx_date_parser(): void
    {
        $today = CarbonImmutable::parse('2026-11-15', 'Asia/Jakarta');
        $ok = fn ($in) => ApproxDate::parse($in, $today)[0];
        $this->assertSame(['2025-01-01', 'year'], $ok('2025'));
        $this->assertSame(['2025-06-01', 'month'], $ok('2025-06'));
        $this->assertSame(['2025-06-01', 'month'], $ok('06/2025'));
        $this->assertSame(['2025-06-12', 'day'], $ok('12/06/2025'));
        $this->assertSame(['2025-06-12', 'day'], $ok('2025-06-12'));
        $this->assertSame(['2026-11-15', 'day'], $ok('15/11/2026')); // today is allowed
        $this->assertSame(['2026-11-01', 'month'], $ok('11/2026'));
        foreach (['16/11/2026', '12/2026', '2027', '31/02/2025', '2025-13', 'kemarin', '', '1850'] as $bad) {
            $this->assertNull($ok($bad), $bad);
        }
        $this->assertSame('2025-06', ApproxDate::format('2025-06-01', 'month'));
    }

    public function test_site_overlap(): void
    {
        $s = fn ($area, $extra = []) => $extra + ['treat_area' => $area, 'tooth' => null, 'surfaces' => null, 'tooth_range' => null, 'quadrant' => null, 'arch' => null];
        $this->assertTrue(ProcedureSite::overlaps($s('surface', ['tooth' => 16, 'surfaces' => 'MO']), $s('surface', ['tooth' => 16, 'surfaces' => 'OD'])));
        $this->assertFalse(ProcedureSite::overlaps($s('surface', ['tooth' => 16, 'surfaces' => 'MO']), $s('surface', ['tooth' => 16, 'surfaces' => 'B'])));
        $this->assertTrue(ProcedureSite::overlaps($s('tooth', ['tooth' => 16]), $s('surface', ['tooth' => 16, 'surfaces' => 'B'])));
        $this->assertFalse(ProcedureSite::overlaps($s('tooth', ['tooth' => 16]), $s('tooth', ['tooth' => 31])));
        $this->assertTrue(ProcedureSite::overlaps($s('mouth'), $s('tooth', ['tooth' => 31])));
        $this->assertTrue(ProcedureSite::overlaps($s('quadrant', ['quadrant' => 1]), $s('tooth', ['tooth' => 54])));
        $this->assertFalse(ProcedureSite::overlaps($s('arch', ['arch' => 'atas']), $s('tooth', ['tooth' => 31])));
        $this->assertTrue(ProcedureSite::overlaps($s('range', ['tooth_range' => '13-23']), $s('tooth', ['tooth' => 21])));
        $this->assertFalse(ProcedureSite::overlaps($s('range', ['tooth_range' => '13-23']), $s('tooth', ['tooth' => 16])));
    }

    public function test_same_site_as_selesai_today_is_rejected_and_cannot_be_confirmed_away(): void
    {
        $visit = $this->visit();
        $this->proc($visit, ['tooth' => 16, 'surfaces' => 'MO', 'procedure_code' => '23.2'])->assertCreated();
        $this->proc($visit, ['tooth' => 16, 'surfaces' => 'OD', 'procedure_code' => '23.2'] + self::EXT)
            ->assertUnprocessable()->assertJsonPath('error', 'external_same_surface');
        $this->proc($visit, ['tooth' => 16, 'treat_area' => 'tooth'] + self::EXT)->assertUnprocessable()->assertJsonPath('error', 'external_same_surface');
        $this->proc($visit, ['treat_area' => 'mouth'] + self::EXT)->assertUnprocessable()->assertJsonPath('error', 'external_same_surface');
        $this->assertSame(0, $this->inA(fn () => ProcedureRecord::where('visit_id', $visit)->where('status', 'ada_di_tempat_lain')->count()));

        // (f) a pending external on 31, then today's selesai on 31: confirming would break the rule => 422, row stays pending
        $id = $this->proc($visit, ['tooth' => 31, 'treat_area' => 'tooth'] + self::EXT)->assertCreated()->assertJsonPath('external_confirmation', 'pending')->json('id');
        $this->proc($visit, ['tooth' => 31, 'surfaces' => 'I', 'procedure_code' => '23.2'])->assertCreated();
        $this->confirm($id, 'depan@senyum.test')->assertUnprocessable()->assertJsonPath('error', 'external_same_surface');
        $this->assertSame('pending', $this->inA(fn () => ProcedureRecord::findOrFail($id)->external_confirmation));
    }

    public function test_pending_external_on_a_day_with_selesai_needs_front_desk_or_assistant_and_never_bills(): void
    {
        $visit = $this->visit();
        $this->proc($visit, ['tooth' => 16, 'surfaces' => 'MOD', 'procedure_code' => '23.2'])->assertCreated();
        $id = $this->proc($visit, ['tooth' => 31, 'surfaces' => 'I', 'procedure_code' => '23.2'] + self::EXT)->assertCreated()
            ->assertJsonPath('external_confirmation', 'pending')->json('id');
        $this->sign($visit)->assertOk();
        $this->assertCount(1, $this->lines($visit)); // the selesai only

        // pending: not chart history, listed for confirmers
        $chart = $this->chart($visit);
        $this->assertNotContains($id, array_column($chart['procedures'], 'id'));
        $this->assertSame([$id], array_column($chart['pending_externals'], 'id'));
        $listed = $this->as('depan@senyum.test')->getJson('/api/procedures/pending-external')->assertOk()->json();
        $this->assertSame([$id], array_column($listed, 'id'));
        $this->assertArrayNotHasKey('diagnosis_code', $listed[0]);
        $this->as(self::DOC)->postJson("/api/procedures/$id/status", ['to' => 'direncanakan'])->assertConflict()->assertJsonPath('error', 'external_unconfirmed');

        foreach ([self::DOC, 'kasir@senyum.test', 'pemilik@senyum.test'] as $who) {
            $this->confirm($id, $who)->assertForbidden();
        }
        $this->as(self::DOC)->getJson('/api/procedures/pending-external')->assertForbidden();

        // final row: the DB trigger lets only the confirmation columns move, and only from pending
        $this->assertThrows(fn () => $this->inA(fn () => ProcedureRecord::findOrFail($id)->update(['external_clinic_name' => 'X'])), QueryException::class);
        $this->confirm($id, 'depan@senyum.test', true, 'Pasien membawa surat klinik lain.')->assertOk()
            ->assertJsonPath('external_confirmation', 'confirmed')->assertJsonPath('external_confirmed_by', $this->user('depan@senyum.test')->id);
        $this->confirm($id, 'asisten@senyum.test')->assertConflict()->assertJsonPath('error', 'not_pending');
        $this->assertThrows(fn () => $this->inA(fn () => ProcedureRecord::findOrFail($id)->update(['external_confirmation' => 'rejected'])), QueryException::class);

        $this->assertContains($id, array_column($this->chart($visit)['procedures'], 'id'));
        $this->inA(fn () => ProcedureController::recorded(ProcedureRecord::findOrFail($id)));
        $this->assertCount(1, $this->lines($visit));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('entity_id', $id)->where('action', 'konfirmasi_tindakan_luar')->count()));
    }

    public function test_assistant_rejects_and_other_tenant_cannot_reach_it(): void
    {
        $visit = $this->visit();
        $this->proc($visit, ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2'])->assertCreated();
        $id = $this->proc($visit, ['tooth' => 46, 'treat_area' => 'tooth'] + self::EXT)->assertCreated()->json('id');

        // another tenant's confirmer: 404 (tenant scope), and nothing changes
        $other = DatabaseSeeder::user('depan@ceria.test', 'Front Desk Ceria', 'lainnya');
        Ctx::runAs($this->tenantB()->id, fn () => Membership::create(['user_id' => $other->id, 'role' => 'front_desk']));
        $this->confirm($id, 'depan@ceria.test')->assertNotFound();
        $this->assertSame([], $this->as('depan@ceria.test')->getJson('/api/procedures/pending-external')->assertOk()->json());

        $this->confirm($id, 'asisten@senyum.test', false, 'Tidak ada bukti.')->assertOk()->assertJsonPath('external_confirmation', 'rejected');
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('entity_id', $id)->where('action', 'tolak_tindakan_luar')->count()));
        $this->assertSame(1, $this->inA(fn () => ProcedureRecord::whereKey($id)->count())); // no DELETE
        $chart = $this->chart($visit);
        $this->assertSame([], $chart['pending_externals']);
        $this->sign($visit)->assertOk();
        $this->assertNotContains($id, array_column($this->chart($visit)['procedures'], 'id'));
    }
}
