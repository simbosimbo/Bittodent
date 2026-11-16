<?php

namespace Tests\Modules\Clinical;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Patients\Models\Patient;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Tests\TestCase;

class WalkInVisitTest extends TestCase
{
    private const DOC = 'dokter@senyum.test';

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** A tenant-A patient without any open visit. */
    private function patient(): string
    {
        return $this->inA(fn () => Patient::whereNotIn('id', Visit::where('status', 'berlangsung')->pluck('patient_id'))
            ->orderBy('created_at')->firstOrFail()->id);
    }

    private function url(string $p): string
    {
        return "/api/patients/$p/visits/walk-in";
    }

    public function test_dentist_opens_walk_in_once_then_replays(): void
    {
        $p = $this->patient();
        $doc = $this->user(self::DOC)->id;
        $r = $this->as(self::DOC)->postJson($this->url($p))->assertCreated()
            ->assertJsonPath('appointment_id', null)->assertJsonPath('status', 'berlangsung')
            ->assertJsonPath('dentist_id', $doc)->assertJsonPath('patient_id', $p);
        $id = $r->json('id');

        $this->assertSame($id, $this->as(self::DOC)->postJson($this->url($p))->assertOk()->json('id'));
        // another note.write user (assistant, Kemang) gets the same open visit
        $this->assertSame($id, $this->as('asisten@senyum.test')->postJson($this->url($p), ['dentist_id' => $doc])->assertOk()->json('id'));
        $this->assertSame(1, $this->inA(fn () => Visit::where('patient_id', $p)->whereNull('appointment_id')->where('status', 'berlangsung')->count()));
        $this->assertSame(1, $this->inA(fn () => AuditEvent::where('action', 'buat')->where('entity_type', 'visit')->where('entity_id', $id)->count()));

        $chart = $this->as(self::DOC)->getJson("/api/patients/$p/chart")->assertOk()->json('visits');
        $this->assertSame([$id, null], [$chart[0]['id'], $chart[0]['appointment_id']]);
    }

    public function test_finished_visit_does_not_block_new_walk_in(): void
    {
        $p = $this->patient();
        $first = $this->as(self::DOC)->postJson($this->url($p))->assertCreated()->json('id');
        $this->inA(fn () => Visit::whereKey($first)->update(['status' => 'selesai', 'ended_at' => now()]));
        $this->assertNotSame($first, $this->as(self::DOC)->postJson($this->url($p))->assertCreated()->json('id'));
    }

    public function test_assistant_must_name_an_active_dentist(): void
    {
        $p = $this->patient();
        $before = $this->inA(fn () => Visit::where('patient_id', $p)->count());
        $as = $this->as('asisten@senyum.test');
        $as->postJson($this->url($p))->assertUnprocessable()->assertJsonValidationErrors('dentist_id');
        $as->postJson($this->url($p), ['dentist_id' => $this->user('depan@senyum.test')->id])->assertUnprocessable();
        $as->postJson($this->url($p), ['dentist_id' => $this->user('dokter@ceria.test')->id])->assertUnprocessable();
        $this->assertSame($before, $this->inA(fn () => Visit::where('patient_id', $p)->count()));

        $as->postJson($this->url($p), ['dentist_id' => $this->user(self::DOC)->id])->assertCreated()
            ->assertJsonPath('dentist_id', $this->user(self::DOC)->id);
    }

    // Audit P1-6: the desk registers a walk-in as arrived ("Pasien datang") with dentist + complaint, but still cannot read the record.
    public function test_front_desk_and_kasir_register_arrival_but_cannot_read_the_record(): void
    {
        $p = $this->patient();
        $doc = $this->user(self::DOC)->id;
        $desk = $this->as('depan@senyum.test');
        $desk->postJson($this->url($p), ['complaint' => 'Gusi bengkak'])->assertUnprocessable()->assertJsonValidationErrors('dentist_id');
        $id = $desk->postJson($this->url($p), ['dentist_id' => $doc, 'complaint' => 'Gusi bengkak'])->assertCreated()
            ->assertJsonMissingPath('complaint')->json('id');
        $this->assertSame($id, $this->as('kasir@senyum.test')->postJson($this->url($p), ['dentist_id' => $doc])->assertOk()->json('id'));
        foreach (['depan@senyum.test', 'kasir@senyum.test'] as $email) {
            $this->as($email)->getJson("/api/patients/$p/chart")->assertForbidden();
        }
        $this->assertSame('Gusi bengkak', $this->as(self::DOC)->getJson("/api/patients/$p/chart")->json('visits.0.complaint'));
        $this->assertFalse($this->inA(fn () => AuditEvent::get()->contains(fn ($e) => str_contains(json_encode($e->detail), 'bengkak'))));
    }

    public function test_other_tenants_are_refused(): void
    {
        $p = $this->patient();
        $before = $this->inA(fn () => Visit::where('patient_id', $p)->count());
        $this->as('dokter@ceria.test')->postJson($this->url($p))->assertNotFound();
        $this->assertSame($before, $this->inA(fn () => Visit::where('patient_id', $p)->count()));
    }

    public function test_schedule_counts_walk_in_patients_without_appointment(): void
    {
        $branch = $this->inA(fn () => Branch::orderBy('name')->firstOrFail()); // Kemang = default active branch
        $today = now('Asia/Jakarta')->format('Y-m-d');
        $count = fn () => $this->as('depan@senyum.test')->getJson("/api/schedule?branch_id={$branch->id}&date=$today")->assertOk()->json('walk_in_patients');
        $base = $count();

        $booked = $this->inA(fn () => Appointment::where('branch_id', $branch->id)->whereNotIn('status', ['cancelled', 'no_show'])
            ->where('starts_at', '>=', now('Asia/Jakarta')->startOfDay()->utc())->where('starts_at', '<', now('Asia/Jakarta')->endOfDay()->utc())
            ->whereNotIn('patient_id', Visit::where('status', 'berlangsung')->pluck('patient_id'))->firstOrFail()->patient_id);
        $this->as(self::DOC)->postJson($this->url($booked))->assertCreated();
        $this->assertSame($base, $count()); // has an appointment today: counts as "dengan janji" only

        $free = $this->inA(fn () => Patient::whereNotIn('id', Visit::where('status', 'berlangsung')->pluck('patient_id'))
            ->whereNotIn('id', Appointment::where('starts_at', '>=', now()->subDays(2))->pluck('patient_id'))->firstOrFail()->id);
        $this->as(self::DOC)->postJson($this->url($free))->assertCreated();
        $this->assertSame($base + 1, $count());
    }

    public function test_schedule_gives_visit_id_only_to_billing_readers(): void
    {
        $branch = $this->inA(fn () => Branch::orderBy('name')->firstOrFail());
        $today = now('Asia/Jakarta')->format('Y-m-d');
        $appt = $this->inA(fn () => Appointment::where('branch_id', $branch->id)->where('status', 'booked')
            ->where('starts_at', '>=', now('Asia/Jakarta')->startOfDay()->utc())->where('starts_at', '<', now('Asia/Jakarta')->endOfDay()->utc())
            ->whereNotIn('id', Visit::whereNotNull('appointment_id')->pluck('appointment_id'))->firstOrFail()->id);
        $visit = $this->as(self::DOC)->postJson("/api/appointments/$appt/visit")->assertCreated()->json('id');
        $find = fn (string $email) => collect($this->as($email)->getJson("/api/schedule?branch_id={$branch->id}&date=$today")->assertOk()->json('chairs'))
            ->flatMap(fn ($c) => $c['appointments']);

        foreach (['kasir@senyum.test', 'depan@senyum.test'] as $email) {
            $rows = $find($email);
            $this->assertSame($visit, $rows->firstWhere('id', $appt)['visit_id']);
            $this->assertTrue($rows->where('id', '!=', $appt)->every(fn ($a) => array_key_exists('visit_id', $a))); // null when no visit yet
        }
        $this->assertFalse(array_key_exists('visit_id', $find(self::DOC)->firstWhere('id', $appt))); // dentist: no billing.read
    }
}
