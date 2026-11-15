<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tariffs\Models\Tariff;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

// Sign-time combination checks (SignCheck): blocks => 422 sign_blocked; warnings => 422 unless accept_warnings + reason.
class SignCheckTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private const SOAP = ['S' => 'Kontrol.', 'O' => 'Pemeriksaan klinis.', 'A' => ['codes' => [], 'text' => ''], 'P' => ['codes' => [], 'text' => '']];

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function draftVisit(array $soap = self::SOAP): string
    {
        $appt = $this->inA(fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => $soap])->assertOk();

        return $visit;
    }

    private function procedure(string $visit, int $tooth, ?string $surfaces, ?string $px, ?string $dx, string $status = 'selesai'): string
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => $tooth, 'surfaces' => $surfaces,
            'status' => $status, 'procedure_code' => $px, 'diagnosis_code' => $dx])->assertCreated()->json('id');
    }

    private function finding(string $visit, int $tooth, ?string $surface, string $condition): string
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/findings", ['tooth' => $tooth, 'surface' => $surface, 'condition' => $condition])
            ->assertCreated()->json('id');
    }

    private function sign(string $visit, array $body = [])
    {
        return $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", $body + ['revision' => 1, 'confirm' => true]);
    }

    private function noteState(string $visit): string
    {
        return $this->inA(fn () => ClinicalNote::where('visit_id', $visit)->firstOrFail()->versions->first()->state);
    }

    public function test_23_01_on_permanent_tooth_is_blocked_and_audited(): void
    {
        $visit = $this->draftVisit();
        $f = $this->procedure($visit, 36, null, '23.01', 'K04.1');

        $r = $this->sign($visit)->assertUnprocessable()->assertJsonPath('error', 'sign_blocked')
            ->assertJsonPath('blocks.0.rule', 'sulung_tetap')->assertJsonPath('blocks.0.procedure_id', $f)->assertJsonPath('blocks.0.tooth', 36);
        $this->assertStringContainsString('23.01 (Extraction of deciduous tooth)', $r->json('blocks.0.message'));
        $this->assertStringContainsString('Pakai 23.09 (Extraction of other tooth)', $r->json('blocks.0.message'));
        $this->assertSame('draft', $this->noteState($visit));
        $this->assertSame('draft', $this->inA(fn () => ProcedureRecord::find($f)->state));
        $audit = $this->inA(fn () => AuditEvent::where('action', 'tanda_tangan_ditolak')->latest('occurred_at')->firstOrFail());
        $this->assertSame(['why' => 'validasi', 'rules' => ['sulung_tetap']], $audit->detail);
    }

    public function test_23_01_on_primary_tooth_signs(): void
    {
        $visit = $this->draftVisit();
        $this->procedure($visit, 75, null, '23.01', 'K00.6');
        $this->sign($visit)->assertOk()->assertJsonPath('procedures_locked', 1);
    }

    public function test_23_09_blocked_on_primary_allowed_on_permanent_and_m3_suggests_23_19(): void
    {
        $visit = $this->draftVisit();
        $this->procedure($visit, 75, null, '23.09', 'K00.6');
        $this->assertStringContainsString('Pakai 23.01 (Extraction of deciduous tooth)', $this->sign($visit)->assertUnprocessable()->json('blocks.0.message'));

        $m3 = $this->draftVisit();
        $this->procedure($m3, 38, null, '23.01', 'K01.1');
        $this->assertStringContainsString('Pakai 23.19 (Other surgical extraction of tooth)', $this->sign($m3)->assertUnprocessable()->json('blocks.0.message'));

        $ok = $this->draftVisit();
        $this->procedure($ok, 36, null, '23.09', 'K04.1');
        $this->sign($ok)->assertOk();
    }

    public function test_procedure_on_tooth_already_missing_is_blocked(): void
    {
        $visit = $this->draftVisit();
        $patient = $this->inA(fn () => Visit::findOrFail($visit)->patient_id);
        $this->inA(fn () => ToothFinding::create(['patient_id' => $patient, 'visit_id' => $visit, 'tooth' => 46, 'surface' => null, 'condition' => 'hilang',
            'status' => 'kondisi_pantau', 'state' => 'final', 'created_by' => $this->user(self::DOC)->id, 'finalized_at' => now()]));
        $this->procedure($visit, 46, null, '23.09', 'K04.1');
        $this->sign($visit)->assertUnprocessable()->assertJsonPath('blocks.0.rule', 'gigi_hilang')->assertJsonPath('blocks.0.tooth', 46);

        // same visit: tooth marked hilang first, then a procedure on it
        $v2 = $this->draftVisit();
        $this->finding($v2, 47, null, 'hilang');
        $this->procedure($v2, 47, 'O', '23.2', 'K02.1');
        $this->sign($v2)->assertUnprocessable()->assertJsonPath('blocks.0.rule', 'gigi_hilang')->assertJsonPath('blocks.0.tooth', 47);
        $this->assertSame('draft', $this->noteState($v2));
    }

    public function test_surface_that_does_not_fit_the_tooth_is_blocked_at_sign(): void
    {
        $visit = $this->draftVisit();
        $patient = $this->inA(fn () => Visit::findOrFail($visit)->patient_id);
        $this->inA(fn () => ToothFinding::create(['patient_id' => $patient, 'visit_id' => $visit, 'tooth' => 11, 'surface' => 'O', 'condition' => 'karies',
            'status' => 'kondisi_pantau', 'state' => 'draft', 'created_by' => $this->user(self::DOC)->id]));
        $this->sign($visit)->assertUnprocessable()->assertJsonPath('blocks.0.rule', 'permukaan');
    }

    public function test_enamel_caries_with_root_canal_warns_then_signs_with_reason(): void
    {
        $visit = $this->draftVisit();
        $this->procedure($visit, 46, null, '23.71', 'K02.0'); // root canal = whole tooth (catalog)
        // Selesai also closes the visit under the invoice guard: give 23.71 a (synthetic) price
        $this->inA(fn () => Tariff::create(['procedure_code' => '23.71', 'name' => 'Perawatan saluran akar (uji)', 'variant' => 'standar',
            'price_rp' => 500000, 'valid_from' => '2026-01-01']));

        $r = $this->sign($visit)->assertUnprocessable()->assertJsonPath('error', 'warnings')->assertJsonPath('warnings.0.rule', 'diagnosis_tindakan');
        $this->assertStringContainsString('K02.0 (Caries limited to enamel)', $r->json('warnings.0.message'));
        $this->assertSame('draft', $this->noteState($visit));
        $this->sign($visit, ['accept_warnings' => true])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->sign($visit, ['accept_warnings' => true, 'reason' => 'pendek'])->assertUnprocessable()->assertJsonValidationErrors('reason');

        $reason = 'Karies meluas ke pulpa saat preparasi (contoh).';
        $this->sign($visit, ['accept_warnings' => true, 'reason' => $reason])->assertOk();
        $audit = $this->inA(fn () => AuditEvent::where('action', 'tanda_tangan')->latest('occurred_at')->firstOrFail());
        $this->assertSame([['diagnosis_tindakan'], $reason], [$audit->detail['warnings_accepted'], $audit->detail['reason']]);
    }

    public function test_soap_codes_are_checked_too(): void
    {
        $visit = $this->draftVisit(['A' => ['codes' => ['K02.0'], 'text' => ''], 'P' => ['codes' => ['23.70'], 'text' => '']] + self::SOAP);
        $r = $this->sign($visit)->assertUnprocessable()->assertJsonPath('warnings.0.finding_id', null);
        $this->assertStringStartsWith('SOAP: ', $r->json('warnings.0.message'));
    }

    public function test_procedure_without_diagnosis_is_a_warning(): void
    {
        $visit = $this->draftVisit();
        $this->procedure($visit, 46, 'O', '23.2', null);
        $this->finding($visit, 36, 'O', 'karies'); // condition only: no warning

        $this->sign($visit)->assertUnprocessable()->assertJsonPath('error', 'warnings')
            ->assertJsonCount(1, 'warnings')->assertJsonPath('warnings.0.rule', 'tanpa_diagnosis');
        $this->sign($visit, ['accept_warnings' => true, 'reason' => 'Diagnosis dicatat di rujukan (contoh).'])->assertOk()
            ->assertJsonPath('findings_locked', 1)->assertJsonPath('procedures_locked', 1);
    }
}
