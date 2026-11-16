<?php

namespace Tests\Feature;

use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// The clinic's customer journey, end to end through the real HTTP API (audit 16-11-2026, docs/audit/2026-11-16-alur-erm.md):
// 1 pasien datang -> 2 keluhan -> 3 dokter mengerjakan -> 4 tindakan (odontogram follows) -> 5 betulkan -> 6 billing.
// Covers the spine that works today. Known gaps are listed in the audit; each fix adds its assertion here.
class PatientJourneyTest extends TestCase
{
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
            'starts_at' => $at->toIso8601String(), 'ends_at' => $at->addMinutes(30)->toIso8601String(), 'reason' => 'Gigi berlubang, ngilu'])->assertCreated()->json('id');
        $this->as($desk)->postJson("/api/appointments/$appt/transition", ['to' => 'checked_in'])->assertOk();
        $this->as($desk)->postJson("/api/appointments/$appt/visit")->assertForbidden(); // only clinical roles open the visit

        // 3-4. dentist: open the record, wrong tooth first, fix it (5), then the real work: tambal komposit 36 O, Selesai
        $visit = $this->as($doc)->postJson("/api/appointments/$appt/visit")->assertCreated()->json('id');
        $wrong = $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 37, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'status' => 'selesai'])->assertCreated()->json('id');
        $this->as($doc)->deleteJson("/api/procedures/$wrong")->assertNoContent();
        $entry = $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 36, 'surfaces' => ['O'], 'condition' => 'tambalan_komposit', 'status' => 'selesai'])
            ->assertCreated()->assertJsonPath('procedure_code', '23.2')->json('id'); // code from the clinic mapping, not typed
        $chart = $this->as($doc)->getJson("/api/patients/$patient/chart")->assertOk()->json('procedure_drafts');
        $this->assertSame([[36, 'O', 'tambalan_komposit', 'selesai']], collect($chart)->map(fn ($p) => [$p['tooth'], $p['surfaces'], $p['condition'], $p['status']])->all()); // odontogram source
        $this->as($doc)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Gigi berlubang, ngilu.', 'O' => 'Karies 36 O.']])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
        $this->as($doc)->postJson("/api/visits/$visit/tooth-entries", ['tooth' => 35, 'surfaces' => ['O'], 'condition' => 'karies', 'status' => 'ada_sebelumnya'])->assertConflict(); // locked

        // 6. kasir: the visit is in the queue with one line per finished procedure, pays in full
        $row = collect($this->as($kasir)->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertSame(['terbuka', ['Tumpatan (contoh) 36']], [$row['status'], $row['items']]);
        $cash = collect($this->as($kasir)->getJson('/api/payment-accounts')->json())->firstWhere('name', 'Kas Kemang')['id'];
        $this->as($kasir)->postJson("/api/invoices/{$row['id']}/payments", ['payment_account_id' => $cash, 'amount_rp' => $row['balance_rp']])->assertCreated()->assertJsonPath('status', 'lunas');

        // reconciliation: every finished, coded procedure of the visit has exactly one invoice line
        Ctx::runAs($this->tenantA()->id, function () use ($visit, $entry) {
            $done = ProcedureRecord::where('visit_id', $visit)->where('state', 'final')->where('status', 'selesai')->whereNotNull('procedure_code')->pluck('id')->all(); // the discarded draft (37) stays as 'discarded', never billed
            $this->assertSame([$entry], $done);
            $this->assertSame(1, InvoiceLine::whereIn('procedure_id', $done)->count());
        });
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

        $this->as('pemilik@senyum.test')->postJson('/api/tariffs', ['procedure_code' => $code, 'name' => 'Mahkota porselen (uji)', 'price_rp' => 2500000])->assertCreated();
        $this->as('pemilik@senyum.test')->postJson('/api/tariffs', ['procedure_code' => $code, 'name' => 'Lagi', 'price_rp' => 1])->assertConflict();
        $this->as($doc)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();

        $row = collect($this->as('kasir@senyum.test')->getJson('/api/billing/invoices')->assertOk()->json('invoices'))->firstWhere('visit_id', $visit);
        $this->assertSame(2500000, $row['balance_rp']);
    }
}
