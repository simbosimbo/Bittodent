<?php

namespace Tests\Modules\Clinical;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Http\Controllers\ProcedureController;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Tenancy\Ctx;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Cache;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

// P0 split (DEVIATIONS #47): tooth_finding = visual condition, procedure_record = treatment. One procedure = one price = one line.
class ProcedureTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function draftVisit(): string
    {
        $appt = $this->inA(fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol.', 'O' => 'Periksa.']])->assertOk();

        return $visit;
    }

    private function proc(string $visit, array $body, string $as = self::DOC)
    {
        return $this->as($as)->postJson("/api/visits/$visit/procedures", $body + ['status' => 'selesai', 'diagnosis_code' => 'K02.1']);
    }

    private function sign(string $visit)
    {
        Cache::flush(); // Fortify refuses a reused TOTP code

        return $this->as(self::DOC)->postJson("/api/visits/$visit/sign", ['revision' => 1, 'confirm' => true,
            'code' => app(Google2FA::class)->getCurrentOtp(DatabaseSeeder::TOTP_SECRET)]);
    }

    private function lines(string $visit)
    {
        return $this->inA(fn () => InvoiceLine::whereIn('invoice_id', Invoice::where('visit_id', $visit)->select('id'))->get());
    }

    public function test_mod_filling_is_one_procedure_one_price_one_line_painted_on_three_surfaces(): void
    {
        $visit = $this->draftVisit();
        $id = $this->proc($visit, ['tooth' => 26, 'surfaces' => ['D', 'O', 'M'], 'procedure_code' => '23.2'])->assertCreated()
            ->assertJsonPath('surfaces', 'MOD')->assertJsonPath('treat_area', 'surface')->assertJsonPath('paint_type', 'Filling')
            ->assertJsonPath('provider_id', $this->user(self::DOC)->id)->json('id');
        $this->sign($visit)->assertOk()->assertJsonPath('procedures_locked', 1);

        $lines = $this->lines($visit);
        $this->assertCount(1, $lines);
        $this->assertSame([$id, 250000, 'MOD', 26], [$lines[0]->procedure_id, $lines[0]->price_rp, $lines[0]->surface, $lines[0]->tooth]);

        // idempotent: re-raising the event for the same procedure (or signing again) never adds a line
        $this->inA(fn () => ProcedureController::recorded(ProcedureRecord::findOrFail($id)));
        $this->sign($visit)->assertConflict();
        $this->assertCount(1, $this->lines($visit));

        $patient = $this->inA(fn () => Visit::findOrFail($visit)->patient_id);
        $p = collect($this->as(self::DOC)->getJson("/api/patients/$patient/chart")->assertOk()->json('procedures'))->firstWhere('id', $id);
        $this->assertSame(['MOD', 'Filling', 'selesai', 'final'], [$p['surfaces'], $p['paint_type'], $p['status'], $p['state']]);
        $this->assertSame(['M', 'O', 'D'], str_split($p['surfaces'])); // the odontogram paints every letter
    }

    public function test_only_selesai_bills_existing_referred_planned_cancelled_condition_never(): void
    {
        $visit = $this->draftVisit();
        foreach (['ada_di_klinik_ini', 'external', 'dirujuk', 'direncanakan', 'cancelled', 'kondisi_pantau'] as $i => $status) {
            $this->proc($visit, ['tooth' => [14, 15, 24, 25, 34, 35][$i], 'surfaces' => 'O', 'procedure_code' => '23.2', 'status' => $status])->assertCreated();
        }
        $this->proc($visit, ['tooth' => 36, 'treat_area' => 'tooth', 'status' => 'selesai'])->assertCreated(); // no code: nothing to bill
        $this->sign($visit)->assertOk()->assertJsonPath('procedures_locked', 7);
        $this->assertCount(0, $this->lines($visit));
    }

    public function test_provider_override_prices_and_snapshots_the_provider_not_the_visit_dentist(): void
    {
        $second = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Budi Contoh', 'dokter_gigi');
        $this->inA(fn () => Membership::create(['user_id' => $second->id, 'role' => 'dentist']));
        $this->as('pemilik@senyum.test')->putJson('/api/tariffs/rates', ['procedure_code' => '23.2', 'variant' => 'standar', 'band' => 'dentist',
            'dentist_id' => $second->id, 'price_rp' => 333000, 'valid_from' => now()->toDateString()])->assertOk();

        $visit = $this->draftVisit();
        $this->proc($visit, ['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2', 'provider_id' => $this->user('dokter@ceria.test')->id])
            ->assertUnprocessable()->assertJsonValidationErrors('provider_id'); // dentist of another tenant
        $this->proc($visit, ['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2', 'provider_id' => $this->user('asisten@senyum.test')->id])
            ->assertUnprocessable()->assertJsonValidationErrors('provider_id'); // not a dentist
        $this->proc($visit, ['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2', 'provider_id' => $second->id])->assertCreated()
            ->assertJsonPath('provider_id', $second->id);
        $this->sign($visit)->assertOk();

        $line = $this->lines($visit)->sole();
        $this->assertNotSame($second->id, $this->inA(fn () => Visit::findOrFail($visit)->dentist_id));
        $this->assertSame([$second->id, 333000], [$line->doctor_id, $line->price_rp]);
    }

    public function test_treat_area_and_surface_validation(): void
    {
        $visit = $this->draftVisit();
        $bad = fn (array $b, string $field) => $this->proc($visit, $b)->assertUnprocessable()->assertJsonValidationErrors($field);
        $bad(['tooth' => 26, 'procedure_code' => '23.2'], 'surfaces');                                    // surface code needs surfaces
        $bad(['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.09'], 'surfaces');                // whole-tooth code refuses surfaces
        $bad(['tooth' => 26, 'surfaces' => 'MX', 'procedure_code' => '23.2'], 'surfaces');                // unknown letter
        $bad(['tooth' => 26, 'surfaces' => 'MOM', 'procedure_code' => '23.2'], 'surfaces');               // duplicate
        $bad(['tooth' => 26, 'surfaces' => 'I', 'procedure_code' => '23.2'], 'surfaces');                 // I is anterior only
        $bad(['tooth' => 11, 'surfaces' => 'MO', 'procedure_code' => '23.2'], 'surfaces');                // O is posterior only
        $bad(['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2', 'treat_area' => 'tooth'], 'treat_area'); // must match catalog
        $bad(['tooth' => 26], 'treat_area');                                                               // no code, no area
        $bad(['tooth' => 19, 'procedure_code' => '23.09'], 'tooth');                                       // not FDI
        $bad(['procedure_code' => '96.54', 'tooth' => 11], 'tooth');                                       // whole mouth: no tooth
        $this->proc($visit, ['procedure_code' => '96.54'])->assertCreated()->assertJsonPath('treat_area', 'mouth')->assertJsonPath('tooth', null);
        $this->proc($visit, ['tooth' => 11, 'surfaces' => 'm, i ,l', 'procedure_code' => '23.2'])->assertCreated()->assertJsonPath('surfaces', 'MIL');
        $this->assertSame([null, 'Permukaan tidak boleh diulang.'], Odontogram::surfaces(26, ['O', 'o']));
    }

    public function test_drafts_are_author_only_and_discard_is_a_state(): void
    {
        $visit = $this->inA(fn () => Visit::whereNotNull('appointment_id')->firstOrFail()->id); // seeded draft visit, Kemang (assistant's branch)
        $id = $this->proc($visit, ['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2'], 'asisten@senyum.test')->assertCreated()->json('id');
        $this->as(self::DOC)->patchJson("/api/procedures/$id", ['surfaces' => 'MO'])->assertForbidden();
        $this->as('asisten@senyum.test')->patchJson("/api/procedures/$id", ['surfaces' => 'MOD'])->assertOk()->assertJsonPath('surfaces', 'MOD');
        $this->as('asisten@senyum.test')->patchJson("/api/procedures/$id", ['variant' => 'p3plus'])->assertOk()
            ->assertJsonPath('surfaces', 'MOD')->assertJsonPath('variant', 'p3plus'); // location kept when not sent
        $this->as('asisten@senyum.test')->patchJson("/api/procedures/$id", ['procedure_code' => '23.09'])->assertUnprocessable()
            ->assertJsonValidationErrors('surfaces'); // extraction is whole-tooth: surfaces must be cleared
        $this->as('asisten@senyum.test')->patchJson("/api/procedures/$id", ['procedure_code' => '23.09', 'surfaces' => null])->assertOk()
            ->assertJsonPath('treat_area', 'tooth')->assertJsonPath('surfaces', null);
        $this->as('asisten@senyum.test')->deleteJson("/api/procedures/$id")->assertNoContent();
        $this->assertSame('discarded', $this->inA(fn () => ProcedureRecord::findOrFail($id)->state));
        $this->as('asisten@senyum.test')->deleteJson("/api/procedures/$id")->assertNotFound();
        // owner: clinical read-only
        $this->proc($visit, ['tooth' => 26, 'surfaces' => 'O', 'procedure_code' => '23.2'], 'pemilik@senyum.test')->assertForbidden();
    }

    public function test_tenant_b_cannot_see_or_touch_tenant_a_procedures(): void
    {
        $a = $this->inA(fn () => ProcedureRecord::where('state', 'final')->firstOrFail());
        Ctx::runAs($this->tenantB()->id, function () use ($a) {
            $this->assertNull(ProcedureRecord::find($a->id));
            $this->assertSame(0, ProcedureDefinition::where('tenant_id', $this->tenantA()->id)->count());
        });
        $this->as('dokter@ceria.test')->postJson("/api/procedures/{$a->id}/status", ['to' => 'selesai'])->assertNotFound();
        $this->as('dokter@ceria.test')->patchJson("/api/procedures/{$a->id}", ['status' => 'selesai'])->assertNotFound();
        $this->as('dokter@ceria.test')->getJson("/api/patients/{$a->patient_id}/chart")->assertNotFound();
    }

    public function test_migration_copies_treatment_findings_one_to_one_without_merging(): void
    {
        $visit = $this->draftVisit();
        $migration = require database_path('migrations/2026_07_01_000001_procedure_entity.php');
        $this->inA(function () use ($visit, $migration) {
            $v = Visit::findOrFail($visit);
            $doc = $this->user(self::DOC)->id;
            $old = fn (?string $s, string $status, ?string $code, ?string $sup = null) => ToothFinding::create(['patient_id' => $v->patient_id,
                'visit_id' => $v->id, 'tooth' => 26, 'surface' => $s, 'condition' => 'tambalan', 'status' => $status, 'procedure_code' => $code,
                'state' => 'final', 'supersedes_id' => $sup, 'created_by' => $doc, 'finalized_at' => now()]);
            // legacy: one MOD filling recorded as three single-surface findings, plus a karies condition and a pantau -> rencana chain
            $mod = [$old('M', 'selesai', '23.2'), $old('O', 'selesai', '23.2'), $old('D', 'selesai', '23.2')];
            $karies = $old('B', 'kondisi_pantau', null);
            $plan = $old('L', 'direncanakan', '23.2', $karies->id);

            $this->assertSame(4, $migration::copyFindings('procedure_id'));
            $this->assertSame(0, $migration::copyFindings('procedure_id')); // idempotent

            foreach ([...$mod, $plan] as $f) {
                $p = ProcedureRecord::findOrFail($f->id); // same id: invoice_line.finding_id values stay valid as procedure_id
                $this->assertSame([$f->surface, 'surface', $f->status, $v->dentist_id], [$p->surfaces, $p->treat_area, $p->status, $p->provider_id]);
            }
            $this->assertNull(ProcedureRecord::find($karies->id));          // visual condition stays a finding only
            $this->assertNull(ProcedureRecord::findOrFail($plan->id)->supersedes_id); // its predecessor is not a procedure
            $this->assertSame(3, ProcedureRecord::where('tooth', 26)->where('procedure_code', '23.2')->where('status', 'selesai')->count()); // never merged
        });
        // every seeded line points at a procedure, one line per procedure (FK + unique)
        $this->inA(function () {
            $lines = InvoiceLine::all();
            $this->assertSame($lines->count(), ProcedureRecord::whereIn('id', $lines->pluck('procedure_id'))->count());
            $this->assertSame($lines->count(), $lines->pluck('procedure_id')->unique()->count());
        });
    }
}
