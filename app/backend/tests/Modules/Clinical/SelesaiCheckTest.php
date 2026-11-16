<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Models\Appointment;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

// KlinikMe-style "lengkapi dulu": everything Selesai would refuse or ask about, listed at once before the dentist presses it.
class SelesaiCheckTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function visit(): string
    {
        $appt = Ctx::runAs($this->tenantA()->id, fn () => Appointment::whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))
            ->orderBy('starts_at')->firstOrFail());
        $visit = $this->as(self::DOC)->postJson("/api/appointments/{$appt->id}/visit")->assertCreated()->json('id');
        $this->as(self::DOC)->putJson("/api/visits/$visit/note", ['soap' => ['S' => 'Ngilu.', 'O' => '', 'A' => ['codes' => [], 'text' => ''],
            'P' => ['codes' => [], 'text' => '']]])->assertOk();

        return $visit;
    }

    private function check(string $visit): array
    {
        return $this->as(self::DOC)->getJson("/api/visits/$visit/selesai-check")->assertOk()->json();
    }

    public function test_no_finished_work_is_listed_before_selesai_and_selesai_agrees(): void
    {
        $visit = $this->visit();
        $c = $this->check($visit);
        $this->assertFalse($c['ready']);
        $this->assertSame([['block', 'no_billable_work']], array_map(fn ($i) => [$i['level'], $i['rule']], $c['items']));
        $this->as(self::DOC)->postJson("/api/visits/$visit/selesai", ['revision' => 1, 'confirm' => true])
            ->assertStatus(409)->assertJsonPath('error', 'no_billable_work');
    }

    public function test_every_issue_comes_back_at_once(): void
    {
        $visit = $this->visit();
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 16, 'surfaces' => 'O', 'procedure_code' => '23.2',
            'variant' => 'standar', 'status' => 'selesai', 'diagnosis_code' => 'K02.1'])->assertCreated();
        $this->assertSame(['ready' => true, 'items' => []], $this->check($visit));

        // no diagnosis = a warning (Selesai with a reason); a primary-tooth extraction on a permanent tooth = a block, both at once
        $this->as(self::DOC)->postJson("/api/visits/$visit/procedures", ['tooth' => 46, 'procedure_code' => '23.01', 'status' => 'selesai'])->assertCreated();
        $c = $this->check($visit);
        $this->assertFalse($c['ready']);
        $this->assertEqualsCanonicalizing([['block', 'sulung_tetap'], ['warn', 'tanpa_diagnosis']], array_map(fn ($i) => [$i['level'], $i['rule']], $c['items']));
    }

    public function test_only_who_may_sign_can_ask(): void
    {
        $visit = $this->visit();
        $this->as('asisten@senyum.test')->getJson("/api/visits/$visit/selesai-check")->assertForbidden();
    }
}
