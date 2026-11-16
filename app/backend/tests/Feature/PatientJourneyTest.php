<?php

namespace Tests\Feature;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use PHPUnit\Framework\AssertionFailedError;
use Tests\TestCase;

// The clinic's customer journey, end to end through the real HTTP API (audit 16-11-2026, docs/audit/2026-11-16-alur-erm.md):
// 1 pasien datang -> 2 keluhan -> 3 dokter mengerjakan -> 4 tindakan (odontogram follows) -> 5 betulkan -> 6 billing.
// Covers the spine that works today. Known gaps are listed in the audit; each fix adds its assertion here.
class PatientJourneyTest extends TestCase
{
    use AssertsReconciled;

    // S9: the seed itself (both demo clinics) must reconcile, so it cannot drift.
    public function test_fresh_seed_is_reconciled(): void
    {
        $this->assertReconciled();
        // R7 is not zero on purpose: these demo codes stay unpriced so "Tindakan tanpa harga" (S1) has something to show and tests
        // can drive the waiting path. A newly mapped code without a price must be added here deliberately.
        $unpriced = ['23.11', '23.3', '23.41', '23.42', '23.43', '23.5', '23.6', '23.70', '23.71'];
        foreach ([$this->tenantA(), $this->tenantB()] as $t) {
            $this->assertSame($unpriced, Ctx::runAs($t->id, fn () => $this->unpricedMappedCodes()), $t->name);
        }
    }

    public function test_gigi_berlubang_from_arrival_to_paid(): void
    {
        $desk = 'depan@senyum.test';
        $doc = 'dokter@senyum.test';
        $kasir = 'kasir@senyum.test';

        // 1-2. front desk: new patient, appointment with the complaint, check-in
        $patient = $this->as($desk)->postJson('/api/patients', ['name' => 'Rina Uji Berlubang', 'dob' => '1990-05-12', 'sex' => 'perempuan'])->assertCreated()->json('id');
        $chair = Ctx::runAs($this->tenantA()->id, fn () => Chair::orderBy('label')->firstOrFail()->id);
        $at = CarbonImmutable::now('Asia/Jakarta')->setTime(19, 0);
        $appt = $this->as($desk)->postJson('/api/appointments', ['patient_id' => $patient, 'chair_id' => $chair, 'dentist_id' => $this->user($doc)->id,
            'starts_at' => $at->toIso8601String(), 'ends_at' => $at->addMinutes(30)->toIso8601String(), 'reason' => 'Periksa gigi'])->assertCreated()->json('id');
        $this->as($desk)->postJson("/api/appointments/$appt/transition", ['to' => 'checked_in', 'complaint' => 'Gigi berlubang, ngilu'])->assertOk();
        $this->as($desk)->postJson("/api/appointments/$appt/visit")->assertForbidden(); // only clinical roles open the visit

        // 3-4. dentist: open the record, wrong tooth first, fix it (5), then the real work: tambal komposit 36 O, Selesai
        $visit = $this->as($doc)->postJson("/api/appointments/$appt/visit")->assertCreated()->json('id');
        $status = fn () => Ctx::runAs($this->tenantA()->id, fn () => Appointment::findOrFail($appt)->status);
        $this->assertSame('in_treatment', $status()); // the schedule shows the chair in use (audit P1-2)
        $this->assertSame('Gigi berlubang, ngilu', $this->as($doc)->getJson("/api/patients/$patient/chart")->json('visits.0.complaint')); // P1-1
        $wrong = $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 37, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'status' => 'selesai'])->assertCreated()->json('id');
        $this->as($doc)->deleteJson("/api/procedures/$wrong")->assertNoContent();
        $entry = $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 36, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'status' => 'selesai'])
            ->assertCreated()->assertJsonPath('procedure_code', '23.2')->json('id'); // code from the clinic mapping, not typed
        $chart = $this->as($doc)->getJson("/api/patients/$patient/chart")->assertOk()->json('procedure_drafts');
        $this->assertSame([[36, 'O', 'tambalan_komposit', 'selesai']], collect($chart)->map(fn ($p) => [$p['tooth'], $p['surfaces'], $p['condition'], $p['status']])->all()); // odontogram source
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Gigi berlubang, ngilu.', 'O' => 'Karies 36 O.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
        $this->assertSame('done', $status()); // Selesai frees the chair
        $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 35, 'surfaces' => ['O'], 'condition' => 'karies', 'status' => 'ada_sebelumnya'])->assertConflict(); // locked

        // 6. kasir: the visit is in the queue with one line per finished procedure, pays in full
        $row = collect($this->as($kasir)->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertSame(['terbuka', ['Tumpatan (contoh) (1 permukaan) 36']], [$row['status'], $row['items']]);
        $cash = collect($this->as($kasir)->getJson('/api/payment-accounts')->json())->firstWhere('name', 'Kas Kemang')['id'];
        $this->as($kasir)->postJson("/api/invoices/{$row['id']}/payments", ['payment_account_id' => $cash, 'amount_rp' => $row['balance_rp']])->assertCreated()->assertJsonPath('status', 'lunas');

        // reconciliation: every finished, coded procedure of the visit has exactly one invoice line
        Ctx::runAs($this->tenantA()->id, function () use ($visit, $entry) {
            $done = ProcedureRecord::where('visit_id', $visit)->where('state', 'final')->where('status', 'selesai')->whereNotNull('procedure_code')->pluck('id')->all(); // the discarded draft (37) stays as 'discarded', never billed
            $this->assertSame([$entry], $done);
            $this->assertSame(1, InvoiceLine::whereIn('procedure_id', $done)->count());
            $this->assertFalse(AuditEvent::get()->contains(fn ($e) => str_contains(json_encode($e->detail), 'ngilu'))); // never logged
        });
        $this->assertReconciled();
    }

    // S1: finished work whose price is not set yet never loses the record and never dead-ends: signed, visit waits, owner prices it, close bills it.
    public function test_tindakan_tanpa_harga_waits_for_the_owner_price_then_bills(): void
    {
        $doc = 'dokter@senyum.test';
        $patient = $this->as('depan@senyum.test')->postJson('/api/patients', ['name' => 'Budi Uji Mahkota', 'dob' => '1985-02-03', 'sex' => 'laki_laki'])->assertCreated()->json('id');
        $visit = $this->as($doc)->postJson("/api/patients/$patient/visits/walk-in")->assertCreated()->json('id');
        $entry = $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 16, 'condition' => 'mahkota_porselen', 'status' => 'selesai'])->assertCreated();
        $code = $entry->json('procedure_code');
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Pasang mahkota.', 'O' => 'Mahkota 16.']])->assertOk();
        $r = $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true, 'accept_warnings' => true, 'reason' => 'Diagnosis ditulis di catatan.']);
        $this->assertSame(409, $r->status(), $r->getContent());
        $r->assertJsonPath('error', 'invoice_required')->assertJsonPath('signed', true);
        $this->assertReconciled(); // signed + open + empty invoice is the legitimate "menunggu harga" state (R4/R5 exception)

        $this->as('pemilik@senyum.test')->postJson('/api/tariffs', ['procedure_code' => $code, 'name' => 'Mahkota porselen (uji)', 'price_rp' => 2500000])->assertCreated();
        $this->as('pemilik@senyum.test')->postJson('/api/tariffs', ['procedure_code' => $code, 'name' => 'Lagi', 'price_rp' => 1])->assertConflict();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        $row = collect($this->as('kasir@senyum.test')->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertSame(2500000, $row['balance_rp']);
        $this->assertReconciled();
    }

    // S2: the dentist picks the stage/level done today (labels only, no prices); the kasir line carries that level's price and label.
    public function test_dentist_picks_the_stage_and_the_kasir_bills_that_level(): void
    {
        $doc = 'dokter@senyum.test';
        $stages = $this->as($doc)->getJson('/api/tariffs/stages')->assertOk()->json()['23.2'];
        $this->assertGreaterThan(1, count($stages));
        $this->assertArrayNotHasKey('price_rp', $stages[1]);
        $patient = $this->as('depan@senyum.test')->postJson('/api/patients', ['name' => 'Sari Uji Tahap', 'dob' => '1992-07-08', 'sex' => 'perempuan'])->assertCreated()->json('id');
        $visit = $this->as($doc)->postJson("/api/patients/$patient/visits/walk-in")->assertCreated()->json('id');
        $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 46, 'surfaces' => ['O', 'D'], 'condition' => 'tambalan_komposit', 'status' => 'selesai',
            'variant' => $stages[1]['variant']])->assertCreated()->assertJsonPath('variant', $stages[1]['variant']);
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Tambal.', 'O' => 'Karies 46 OD.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true, 'accept_warnings' => true, 'reason' => 'Diagnosis ditulis di catatan.'])->assertOk();
        $row = collect($this->as('kasir@senyum.test')->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertStringContainsString('('.$stages[1]['label'].')', $row['items'][0]);
        $this->assertSame(350000, $row['balance_rp']);
        $this->assertReconciled();
    }

    // S3: the dentist records the procedure (cabut 46), the odontogram fills itself ("hilang"), and the kasir bills it (audit P0-2).
    public function test_cabut_recorded_as_a_procedure_fills_the_odontogram_and_bills(): void
    {
        $doc = 'dokter@senyum.test';
        $patient = $this->as('depan@senyum.test')->postJson('/api/patients', ['name' => 'Dodi Uji Cabut', 'dob' => '1979-11-20', 'sex' => 'laki_laki'])->assertCreated()->json('id');
        $visit = $this->as($doc)->postJson("/api/patients/$patient/visits/walk-in")->assertCreated()->json('id');
        $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 46, 'procedure_code' => '23.09', 'status' => 'selesai'])
            ->assertCreated()->assertJsonPath('condition', 'hilang')->assertJsonPath('status', 'selesai');
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Gigi goyang.', 'O' => 'Gigi 46 goyang derajat 3.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true, 'accept_warnings' => true, 'reason' => 'Diagnosis ditulis di catatan.'])->assertOk();
        $row = collect($this->as('kasir@senyum.test')->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertCount(1, $row['items']);
        $this->assertStringContainsString('46', $row['items'][0]);
        $this->assertSame(150000, $row['balance_rp']);
        $this->assertReconciled();
    }

    // S2: an unpriced procedure can get its stages at creation, so they apply today (not from tomorrow).
    public function test_owner_prices_a_new_procedure_with_stages_today(): void
    {
        $owner = 'pemilik@senyum.test';
        $this->as($owner)->postJson('/api/tariffs', ['procedure_code' => '23.70', 'name' => 'PSA (uji)', 'levels' => [
            ['code' => 'k1', 'label' => 'Kunjungan 1', 'price_rp' => 400000], ['code' => 'k2', 'label' => 'Lanjutan', 'price_rp' => 0]]])->assertCreated();
        $this->assertSame([['variant' => 'k1', 'label' => 'Kunjungan 1'], ['variant' => 'k2', 'label' => 'Lanjutan']],
            $this->as('dokter@senyum.test')->getJson('/api/tariffs/stages')->assertOk()->json()['23.70']);
        $this->as($owner)->postJson('/api/tariffs', ['procedure_code' => '23.71', 'name' => 'x', 'price_rp' => 1, 'levels' => [['code' => 'a', 'label' => 'A', 'price_rp' => 1]]])->assertUnprocessable();
    }

    // S5: the dentist may open the record before the desk checks the patient in; the complaint typed at check-in still reaches it.
    public function test_complaint_typed_at_check_in_after_the_record_was_opened_reaches_the_chart(): void
    {
        $desk = 'depan@senyum.test';
        $doc = 'dokter@senyum.test';
        $patient = $this->as($desk)->postJson('/api/patients', ['name' => 'Tono Uji Urutan', 'dob' => '1980-01-02', 'sex' => 'laki_laki'])->assertCreated()->json('id');
        $chair = Ctx::runAs($this->tenantA()->id, fn () => Chair::orderBy('label')->firstOrFail()->id);
        $at = CarbonImmutable::now('Asia/Jakarta')->setTime(20, 0);
        $appt = $this->as($desk)->postJson('/api/appointments', ['patient_id' => $patient, 'chair_id' => $chair, 'dentist_id' => $this->user($doc)->id,
            'starts_at' => $at->toIso8601String(), 'ends_at' => $at->addMinutes(30)->toIso8601String(), 'reason' => 'Periksa'])->assertCreated()->json('id');
        $this->as($doc)->postJson("/api/appointments/$appt/visit")->assertCreated();
        $this->as($desk)->postJson("/api/appointments/$appt/transition", ['to' => 'checked_in', 'complaint' => 'Gusi bengkak sejak kemarin'])->assertOk();
        $visit = collect($this->as($doc)->getJson("/api/patients/$patient/chart")->assertOk()->json('visits'))->firstWhere('status', 'berlangsung');
        $this->assertSame('Gusi bengkak sejak kemarin', $visit['complaint']);
    }

    // S9: appointment -> cabut 48 at the "Sulit" stage -> Selesai: the appointment is done (R3) and the line carries the stage price.
    public function test_appointment_cabut_with_stage_reconciles(): void
    {
        $desk = 'depan@senyum.test';
        $doc = 'dokter@senyum.test';
        $patient = $this->as($desk)->postJson('/api/patients', ['name' => 'Eko Uji Cabut Sulit', 'dob' => '1975-04-09', 'sex' => 'laki_laki'])->assertCreated()->json('id');
        $chair = Ctx::runAs($this->tenantA()->id, fn () => Chair::orderBy('label')->firstOrFail()->id);
        $at = CarbonImmutable::now('Asia/Jakarta')->setTime(21, 0);
        $appt = $this->as($desk)->postJson('/api/appointments', ['patient_id' => $patient, 'chair_id' => $chair, 'dentist_id' => $this->user($doc)->id,
            'starts_at' => $at->toIso8601String(), 'ends_at' => $at->addMinutes(45)->toIso8601String(), 'reason' => 'Cabut'])->assertCreated()->json('id');
        $this->as($desk)->postJson("/api/appointments/$appt/transition", ['to' => 'checked_in', 'complaint' => 'Gigi bungsu sakit'])->assertOk();
        $visit = $this->as($doc)->postJson("/api/appointments/$appt/visit")->assertCreated()->json('id');
        $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 48, 'procedure_code' => '23.09', 'status' => 'selesai', 'variant' => 'sulit'])->assertCreated();
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Gigi bungsu sakit.', 'O' => 'Gigi 48 impaksi sebagian.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true, 'accept_warnings' => true, 'reason' => 'Diagnosis ditulis di catatan.'])->assertOk();
        $row = collect($this->as('kasir@senyum.test')->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertSame(300000, $row['balance_rp']);
        $this->assertReconciled();
    }

    // S9: front desk registers a walk-in with a complaint; Selesai without work is refused (no_billable_work); a Kontrol 89.31 at Rp0 bills and closes.
    public function test_walk_in_check_up_only_bills_kontrol_rp0_and_reconciles(): void
    {
        $doc = 'dokter@senyum.test';
        $patient = $this->as('depan@senyum.test')->postJson('/api/patients', ['name' => 'Fitri Uji Kontrol', 'dob' => '1995-09-14', 'sex' => 'perempuan'])->assertCreated()->json('id');
        $visit = $this->as('depan@senyum.test')->postJson("/api/patients/$patient/visits/walk-in", ['dentist_id' => $this->user($doc)->id, 'complaint' => 'Kontrol pasca cabut'])
            ->assertCreated()->json('id');
        $this->assertSame('Kontrol pasca cabut', $this->as($doc)->getJson("/api/patients/$patient/chart")->json('visits.0.complaint'));
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Kontrol pasca cabut.', 'O' => 'Soket menutup baik.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertConflict()->assertJsonPath('error', 'no_billable_work');
        $this->assertReconciled(); // refused: nothing signed, visit still open, no invoice

        $this->as($doc)->postJson("/api/visits/$visit/procedures", ['procedure_code' => '89.31', 'variant' => 'kontrol', 'status' => 'selesai'])->assertCreated();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true, 'accept_warnings' => true, 'reason' => 'Diagnosis ditulis di catatan.'])->assertOk();
        $this->as('kasir@senyum.test')->getJson("/api/visits/$visit/invoice")->assertOk()->assertJsonPath('balance_rp', 0)->assertJsonPath('status', 'lunas');
        $this->assertReconciled();
    }

    // S9: the check is not vacuous: a visit closed behind the guard's back (finished, coded work, no invoice) fails R1 and R6 by id.
    public function test_reconciliation_names_the_broken_invariant(): void
    {
        $doc = $this->user('dokter@senyum.test');
        [$visit, $proc] = Ctx::runAs($this->tenantA()->id, function () use ($doc) {
            $v = Visit::create(['patient_id' => $this->patientOf($this->tenantA())->id, 'branch_id' => Chair::firstOrFail()->branch_id, 'dentist_id' => $doc->id,
                'started_at' => now(), 'ended_at' => now(), 'status' => 'selesai']);

            return [$v->id, DatabaseSeeder::procedure($v, 36, 'O', 'selesai', '23.2', null, 'final', $doc)->id];
        });
        try {
            $this->assertReconciled();
        } catch (AssertionFailedError $e) {
            $this->assertStringContainsString("R1 kunjungan selesai, tindakan selesai berkode tanpa baris tagihan\": [\n        \"$proc\"", $e->getMessage());
            $this->assertStringContainsString("R6 kunjungan selesai tanpa tagihan\": [\n        \"$visit\"", $e->getMessage());

            return;
        }
        $this->fail('assertReconciled accepted a closed visit with unbilled work');
    }
}
