<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Audit S8 (P2-1): a dentist sets the clinic's default ICD-10 per procedure in Pengaturan RM; a procedure saved without a diagnosis
// and without a matching coding_rule gets it, so Selesai stops warning "tanpa diagnosis" for scaling, pemeriksaan, mahkota, ...
class DefaultDiagnosisTest extends TestCase
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

    private function setDefault(string $code, ?string $icd10, string $as = self::DOC)
    {
        return $this->as($as)->putJson("/api/procedure-catalog/$code/diagnosis", ['icd10' => $icd10]);
    }

    public function test_icd10_search_returns_only_valid_official_codes_by_code_and_caps_at_20(): void
    {
        // K02.0 invalidated on a separate admin connection (committed, so ehr_app sees it) before any ehr_app read; restored in finally
        config(['database.connections.icd_tmp' => config('database.connections.mysql_admin')]);
        $tmp = DB::connection('icd_tmp');
        $tmp->table('icd10_codes')->where('code', 'K02.0')->update(['valid' => false]);
        try {
            $codes = $this->as(self::DOC)->getJson('/api/icd10?q=K02')->assertOk()->json('*.code');
            $this->assertContains('K02.1', $codes);
            $this->assertNotContains('K02.0', $codes);

            $many = $this->as(self::DOC)->getJson('/api/icd10?q=K0')->assertOk()->json('*.code');
            $this->assertCount(20, $many);
            $this->assertSame($many, collect($many)->sort()->values()->all());

            $this->assertContains('Z01.2', $this->as(self::DOC)->getJson('/api/icd10?q=dental exam')->json('*.code')); // title substring
            $this->assertSame([], $this->as(self::DOC)->getJson('/api/icd10?q=%25%25')->assertOk()->json()); // % is literal, not a wildcard
            $this->as(self::DOC)->getJson('/api/icd10?q=K')->assertUnprocessable();
            $this->as('kasir@senyum.test')->getJson('/api/icd10?q=K02')->assertForbidden();
        } finally {
            $tmp->table('icd10_codes')->where('code', 'K02.0')->update(['valid' => true]);
        }
    }

    public function test_only_a_dentist_sets_or_clears_a_default_with_an_official_code_and_it_is_audited(): void
    {
        foreach (['pemilik@senyum.test', 'asisten@senyum.test', 'depan@senyum.test'] as $who) {
            $this->setDefault('89.31', 'Z01.2', $who)->assertForbidden();
        }
        foreach (['K02.5', 'z01.2', 'bukan'] as $bad) { // not in the 2010 list, wrong case, malformed
            $this->setDefault('89.31', $bad)->assertUnprocessable()->assertJsonValidationErrors('icd10');
        }
        $this->setDefault('00.00', 'Z01.2')->assertNotFound(); // not in this clinic's catalog

        $this->setDefault('89.31', 'Z01.2')->assertOk()->assertJsonPath('default_icd10', 'Z01.2')
            ->assertJsonPath('default_icd10_display', 'Dental examination');
        $row = collect($this->as(self::DOC)->getJson('/api/procedure-catalog')->assertOk()->json())->firstWhere('procedure_code', '89.31');
        $this->assertSame(['Z01.2', 'Dental examination'], [$row['default_icd10'], $row['default_icd10_display']]);

        $this->setDefault('89.31', null)->assertOk()->assertJsonPath('default_icd10', null);
        $audit = $this->inA(fn () => AuditEvent::where('action', 'ubah_diagnosis_bawaan')->orderBy('id')->get());
        $this->assertEquals([['procedure_code' => '89.31', 'from' => null, 'to' => 'Z01.2'], ['procedure_code' => '89.31', 'from' => 'Z01.2', 'to' => null]],
            $audit->pluck('detail')->all());
        $this->assertSame($this->user(self::DOC)->id, $audit[0]->actor_id);
    }

    public function test_a_kontrol_saved_without_diagnosis_gets_the_default_and_selesai_has_no_warning(): void
    {
        $before = $this->draftVisit();
        $this->as(self::DOC)->postJson("/api/visits/$before/procedures", ['procedure_code' => '89.31', 'variant' => 'kontrol', 'status' => 'selesai'])
            ->assertCreated()->assertJsonPath('diagnosis_code', null);
        $this->as(self::DOC)->postJson("/api/visits/$before/selesai", ['revision' => 1, 'confirm' => true])
            ->assertUnprocessable()->assertJsonPath('error', 'warnings')->assertJsonPath('warnings.0.rule', 'tanpa_diagnosis');

        $this->setDefault('89.31', 'Z01.2')->assertOk();
        $visit = $this->draftVisit();
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['procedure_code' => '89.31', 'variant' => 'kontrol', 'status' => 'selesai'])
            ->assertCreated()->assertJsonPath('diagnosis_code', 'Z01.2')->assertJsonPath('diagnosis_source', 'aturan');
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])->assertOk();
        $this->assertSame('selesai', $this->inA(fn () => Visit::findOrFail($visit)->status));
    }

    public function test_a_coding_rule_for_the_tooth_still_wins_over_the_default(): void
    {
        $this->setDefault('23.2', 'Z01.2')->assertOk();
        $v = $this->inA(fn () => Visit::whereNotNull('appointment_id')->where('patient_id', $this->patientOf($this->tenantA())->id)->firstOrFail());
        $entry = $this->as(self::DOC)->postJson("/api/visits/{$v->id}/tooth-entries", ['tooth' => 26, 'surfaces' => ['O'],
            'condition' => 'tambalan_komposit', 'status' => 'selesai'])->assertCreated()->assertJsonPath('procedure_code', '23.2');
        $this->assertMatchesRegularExpression('/^K02\\./', $entry->json('diagnosis_code'));
    }
}
