<?php

namespace Tests\Modules\Scheduling;

use App\Modules\Scheduling\Http\Controllers\AppointmentController;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// POST /api/appointments/{id}/undo-checkin: the Jadwal toast's "Batalkan" (board 08). checked_in -> booked within a short window, audited.
class UndoCheckinTest extends TestCase
{
    private function booked(): string
    {
        return $this->at(9);
    }

    public function test_undo_right_after_check_in_returns_to_booked_and_is_audited(): void
    {
        $id = $this->booked();
        $r = $this->as('kasir@senyum.test');
        $r->postJson("/api/appointments/$id/transition", ['to' => 'checked_in'])->assertOk();
        $r->postJson("/api/appointments/$id/undo-checkin")->assertOk()->assertJsonPath('status', 'booked')->assertJsonPath('arrived_at', null);
        $this->assertTrue(Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('action', 'batal_checkin')->where('entity_id', $id)->exists()));
        // nothing left to undo; a second check-in works again
        $r->postJson("/api/appointments/$id/undo-checkin")->assertStatus(409);
        $r->postJson("/api/appointments/$id/transition", ['to' => 'checked_in'])->assertOk();
    }

    public function test_undo_refused_after_the_window_or_once_treatment_started(): void
    {
        $id = $this->booked();
        $r = $this->as('depan@senyum.test');
        $r->postJson("/api/appointments/$id/transition", ['to' => 'checked_in'])->assertOk();
        Ctx::runAs($this->tenantA()->id, fn () => Appointment::whereKey($id)->update(['arrived_at' => now()->subSeconds(AppointmentController::UNDO_CHECKIN_SECONDS + 5)]));
        $r->postJson("/api/appointments/$id/undo-checkin")->assertStatus(409);

        $id2 = $this->booked2();
        $r->postJson("/api/appointments/$id2/transition", ['to' => 'checked_in'])->assertOk();
        $r->postJson("/api/appointments/$id2/transition", ['to' => 'in_treatment'])->assertOk();
        $r->postJson("/api/appointments/$id2/undo-checkin")->assertStatus(409);
        // the general state machine still has no checked_in -> booked
        $id3 = $this->booked3();
        $r->postJson("/api/appointments/$id3/transition", ['to' => 'checked_in'])->assertOk();
        $r->postJson("/api/appointments/$id3/transition", ['to' => 'booked'])->assertStatus(409);
    }

    public function test_another_tenant_cannot_undo(): void
    {
        $id = $this->booked();
        $this->as('depan@senyum.test')->postJson("/api/appointments/$id/transition", ['to' => 'checked_in'])->assertOk();
        $this->as('kasir@ceria.test')->postJson("/api/appointments/$id/undo-checkin")->assertNotFound();
        $this->assertSame('checked_in', Ctx::runAs($this->tenantA()->id, fn () => Appointment::findOrFail($id)->status));
    }

    private function booked2(): string
    {
        return $this->at(10);
    }

    private function booked3(): string
    {
        return $this->at(11);
    }

    private function at(int $hour): string
    {
        $a = $this->tenantA()->id;
        [$chair, $p] = Ctx::runAs($a, fn () => [Chair::orderBy('label')->firstOrFail(), $this->patientOf($this->tenantA())]);
        $start = CarbonImmutable::now('Asia/Jakarta')->addDays(7)->setTime($hour, 0);

        return $this->as('depan@senyum.test')->postJson('/api/appointments', ['patient_id' => $p->id, 'chair_id' => $chair->id,
            'dentist_id' => $this->user('dokter@senyum.test')->id, 'starts_at' => $start->toIso8601String(),
            'ends_at' => $start->addMinutes(30)->toIso8601String()])->assertCreated()->json('id');
    }
}
