<?php

namespace Tests\Modules\Scheduling;

use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AppointmentApiTest extends TestCase
{
    public function test_double_booking_409_and_state_machine(): void
    {
        $a = $this->tenantA()->id;
        [$chair, $p] = Ctx::runAs($a, fn () => [Chair::orderBy('label')->firstOrFail(), $this->patientOf($this->tenantA())]);
        $start = CarbonImmutable::now('Asia/Jakarta')->addDays(5)->setTime(10, 0);
        $body = ['patient_id' => $p->id, 'chair_id' => $chair->id, 'dentist_id' => $this->user('dokter@senyum.test')->id,
            'starts_at' => $start->toIso8601String(), 'ends_at' => $start->addMinutes(30)->toIso8601String()];
        $r = $this->as('depan@senyum.test');
        $id = $r->postJson('/api/appointments', $body)->assertCreated()->json('id');
        $r->postJson('/api/appointments', [...$body, 'starts_at' => $start->addMinutes(15)->toIso8601String(), 'ends_at' => $start->addMinutes(45)->toIso8601String()])
            ->assertStatus(409)->assertJsonPath('error', 'chair_busy');
        // back-to-back is fine
        $r->postJson('/api/appointments', [...$body, 'starts_at' => $start->addMinutes(30)->toIso8601String(), 'ends_at' => $start->addMinutes(60)->toIso8601String()])->assertCreated();

        $r->postJson("/api/appointments/$id/transition", ['to' => 'done'])->assertStatus(409);
        foreach (['checked_in', 'in_treatment', 'done'] as $to) {
            $r->postJson("/api/appointments/$id/transition", ['to' => $to])->assertOk()->assertJsonPath('status', $to);
        }
        $r->postJson("/api/appointments/$id/transition", ['to' => 'cancelled'])->assertStatus(409);
        // a cancelled slot can be rebooked
        $other = $r->postJson('/api/appointments', [...$body, 'starts_at' => $start->addHours(3)->toIso8601String(), 'ends_at' => $start->addHours(4)->toIso8601String()])->json('id');
        $r->postJson("/api/appointments/$other/transition", ['to' => 'cancelled'])->assertOk();
        $r->postJson('/api/appointments', [...$body, 'starts_at' => $start->addHours(3)->toIso8601String(), 'ends_at' => $start->addHours(4)->toIso8601String()])->assertCreated();
    }

    public function test_dentist_double_booking_across_chairs_and_branches(): void
    {
        $a = $this->tenantA()->id;
        $doc = $this->user('dokter@senyum.test');
        [$chairs, $p, $doc2] = Ctx::runAs($a, function () {
            $doc2 = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Dua Contoh', 'dokter_gigi');
            Membership::create(['user_id' => $doc2->id, 'role' => 'dentist']);

            // chairs from both branches of tenant A
            return [Chair::orderBy('branch_id')->orderBy('label')->get(), $this->patientOf($this->tenantA()), $doc2];
        });
        $this->assertNotEquals($chairs[0]->branch_id, $chairs->last()->branch_id);
        $t = CarbonImmutable::now('UTC')->addDays(6)->setTime(3, 0);
        $book = fn ($chair, $dentist, $from, $to) => $this->as('pemilik@senyum.test')->postJson('/api/appointments', [
            'patient_id' => $p->id, 'chair_id' => $chair->id, 'dentist_id' => $dentist->id,
            'starts_at' => $t->addMinutes($from)->toIso8601String(), 'ends_at' => $t->addMinutes($to)->toIso8601String()]);

        $id = $book($chairs[0], $doc, 0, 30)->assertCreated()->json('id');
        // same dentist, other chair in the other branch, overlapping
        $book($chairs->last(), $doc, 15, 45)->assertStatus(409)->assertJsonPath('error', 'dentist_busy')->assertJsonPath('id', $id);
        // same chair still reports chair_busy first
        $book($chairs[0], $doc, 10, 20)->assertStatus(409)->assertJsonPath('error', 'chair_busy');
        // adjacent (end == start) is fine
        $book($chairs->last(), $doc, 30, 60)->assertCreated();
        // other dentist, same time, other chair is fine
        $book($chairs[1], $doc2, 0, 30)->assertCreated();

        // cancelled and no_show appointments do not block the dentist
        foreach (['cancelled' => 120, 'no_show' => 180] as $to => $at) {
            $gone = $book($chairs[0], $doc, $at, $at + 30)->assertCreated()->json('id');
            $this->as('pemilik@senyum.test')->postJson("/api/appointments/$gone/transition", ['to' => $to])->assertOk();
            $book($chairs[2], $doc, $at, $at + 30)->assertCreated();
        }

        // another tenant's appointment for the same user id is never considered
        Ctx::runAs($this->tenantB()->id, fn () => Appointment::create([
            'branch_id' => ($bc = Chair::firstOrFail())->branch_id, 'chair_id' => $bc->id, 'dentist_id' => $doc->id,
            'patient_id' => $this->patientOf($this->tenantB())->id, 'starts_at' => $t->addMinutes(300), 'ends_at' => $t->addMinutes(360),
            'status' => 'booked', 'created_by' => $doc->id]));
        $book($chairs[0], $doc, 300, 360)->assertCreated();
    }

    public function test_schedule_has_chairs_and_appointments_without_n_plus_one(): void
    {
        $branch = Ctx::runAs($this->tenantA()->id, fn () => Branch::orderBy('name')->firstOrFail());
        DB::connection('mysql')->enableQueryLog();
        $res = $this->as('dokter@senyum.test')->getJson('/api/schedule?branch_id='.$branch->id.'&date='.now('Asia/Jakarta')->format('Y-m-d'))->assertOk();
        $chairs = $res->json('chairs');
        $this->assertCount(3, $chairs);
        $this->assertGreaterThan(0, array_sum(array_map(fn ($c) => count($c['appointments']), $chairs)));
        $this->assertArrayHasKey('name', $chairs[0]['appointments'][0]['patient']);
        $this->assertContains($this->user('dokter@senyum.test')->id, array_column($res->json('dentists'), 'id'));
        $this->assertLessThan(14, count(DB::connection('mysql')->getQueryLog())); // constant, not per appointment
    }

    public function test_front_desk_restricted_to_own_branch_schedule(): void
    {
        $other = Ctx::runAs($this->tenantA()->id, fn () => Branch::where('name', 'like', '%Rawamangun%')->firstOrFail());
        $this->as('depan@senyum.test')->getJson('/api/schedule?branch_id='.$other->id.'&date=2026-11-14')->assertForbidden();
    }
}
