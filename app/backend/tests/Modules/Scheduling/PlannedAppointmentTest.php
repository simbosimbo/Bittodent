<?php

namespace Tests\Modules\Scheduling;

use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Models\PlannedAppointment;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class PlannedAppointmentTest extends TestCase
{
    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    private function kemang(): Branch
    {
        return $this->inA(fn () => Branch::orderBy('name')->firstOrFail());
    }

    public function test_dentist_plans_front_desk_converts_idempotently(): void
    {
        $p = $this->patientOf($this->tenantA())->id;
        $b = $this->kemang();
        $id = $this->as('dokter@senyum.test')->postJson("/api/patients/$p/planned-appointments",
            ['procedure' => 'Mahkota 46 (uji)', 'procedure_code' => '23.41', 'est_minutes' => 60, 'priority' => 'segera', 'note' => 'Sore saja'])
            ->assertCreated()->assertJsonPath('status', 'perlu_dijadwalkan')->json('id');
        $this->as('asisten@senyum.test')->postJson("/api/patients/$p/planned-appointments", ['procedure' => 'Kontrol', 'est_minutes' => 30])->assertUnprocessable(); // must name the dentist
        $this->as('asisten@senyum.test')->postJson("/api/patients/$p/planned-appointments", ['procedure' => 'Kontrol', 'est_minutes' => 30,
            'dentist_id' => $this->user('dokter@senyum.test')->id])->assertCreated();
        $this->as('depan@senyum.test')->postJson("/api/patients/$p/planned-appointments", ['procedure' => 'X', 'est_minutes' => 30])->assertForbidden();

        $list = $this->as('depan@senyum.test')->getJson("/api/planned-appointments?branch_id={$b->id}")->assertOk()->json('data');
        $this->assertSame('segera', $list[0]['priority']);
        $this->assertContains($id, array_column($list, 'id'));
        $this->assertSame('Mahkota 46 (uji)', collect($list)->firstWhere('id', $id)['procedure']);
        $this->assertNotNull(collect($list)->firstWhere('id', $id)['patient_name']);

        $chair = $this->inA(fn () => Chair::where('branch_id', $b->id)->orderBy('label')->firstOrFail());
        $appt = $this->as('depan@senyum.test')->postJson("/api/planned-appointments/$id/schedule", ['chair_id' => $chair->id, 'starts_at' => '2030-02-01T02:00:00Z'])
            ->assertCreated()->json('appointment_id');
        $this->as('depan@senyum.test')->postJson("/api/planned-appointments/$id/schedule", ['chair_id' => $chair->id, 'starts_at' => '2030-02-02T02:00:00Z'])
            ->assertOk()->assertJsonPath('appointment_id', $appt); // idempotent: no second appointment
        $a = $this->inA(fn () => Appointment::findOrFail($appt));
        $this->assertSame([$p, 60], [$a->patient_id, (int) $a->starts_at->diffInMinutes($a->ends_at)]);
        $this->assertSame(1, $this->inA(fn () => Appointment::where('patient_id', $p)->where('starts_at', '>=', '2030-01-01')->count()));
        $this->assertNotContains($id, array_column($this->as('depan@senyum.test')->getJson("/api/planned-appointments?branch_id={$b->id}")->json('data'), 'id'));

        // busy chair: 409 and the plan stays in the list
        $other = $this->inA(fn () => PlannedAppointment::where('status', 'perlu_dijadwalkan')->firstOrFail());
        $this->as('depan@senyum.test')->postJson("/api/planned-appointments/{$other->id}/schedule", ['chair_id' => $chair->id, 'starts_at' => '2030-02-01T02:30:00Z'])
            ->assertConflict();
        $this->assertSame('perlu_dijadwalkan', $this->inA(fn () => $other->fresh()->status));
    }

    public function test_transitions_stamp_arrived_seated_dismissed_and_expose_minutes(): void
    {
        $a = $this->inA(fn () => Appointment::where('status', 'booked')->where('branch_id', $this->kemang()->id)->orderBy('starts_at')->firstOrFail());
        $r = $this->as('depan@senyum.test');
        $this->travelTo(now()->setTime(2, 0));
        $r->postJson("/api/appointments/{$a->id}/transition", ['to' => 'checked_in'])->assertOk()->assertJsonPath('wait_minutes', null);
        $this->travel(12)->minutes();
        $r->postJson("/api/appointments/{$a->id}/transition", ['to' => 'in_treatment'])->assertOk()->assertJsonPath('wait_minutes', 12);
        $this->travel(40)->minutes();
        $res = $r->postJson("/api/appointments/{$a->id}/transition", ['to' => 'done'])->assertOk()->assertJsonPath('chair_minutes', 40);
        $this->assertNotNull($res->json('arrived_at'));
        $this->assertNotNull($res->json('dismissed_at'));
    }

    public function test_reschedule_uses_double_booking_checks(): void
    {
        [$x, $y] = $this->inA(fn () => Appointment::where('status', 'booked')->where('branch_id', $this->kemang()->id)->orderBy('starts_at')->limit(2)->get()->all());
        $r = $this->as('depan@senyum.test');
        // onto y's chair+time: busy
        $r->postJson("/api/appointments/{$x->id}/reschedule", ['chair_id' => $y->chair_id, 'starts_at' => $y->starts_at->toIso8601ZuluString(),
            'ends_at' => $y->ends_at->toIso8601ZuluString()])->assertConflict();
        // own slot shifted by 5 minutes (overlaps only itself): fine
        $r->postJson("/api/appointments/{$x->id}/reschedule", ['starts_at' => '2030-03-01T02:00:00Z', 'ends_at' => '2030-03-01T02:45:00Z'])->assertOk();
        $r->postJson("/api/appointments/{$x->id}/reschedule", ['starts_at' => '2030-03-01T02:05:00Z', 'ends_at' => '2030-03-01T02:50:00Z'])->assertOk();
        $r->postJson("/api/appointments/{$x->id}/transition", ['to' => 'cancelled'])->assertOk();
        $r->postJson("/api/appointments/{$x->id}/reschedule", ['starts_at' => '2030-03-02T02:00:00Z', 'ends_at' => '2030-03-02T02:45:00Z'])->assertConflict();
    }
}
