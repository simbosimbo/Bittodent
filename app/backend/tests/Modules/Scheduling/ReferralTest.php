<?php

namespace Tests\Modules\Scheduling;

use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Audit\AuditEvent;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Collection;
use Tests\TestCase;

// DEVIATIONS #68: Jadwal is organised by dentist. The chair is freely changeable (Ganti kursi, chair clash still checked);
// the dentist is not: reschedule/chair change reject a dentist change, the only path is Rujuk (reason, permission, audit).
class ReferralTest extends TestCase
{
    private CarbonImmutable $t;

    /** @return array{0: Collection<int, Chair>, 1: string, 2: string} chairs of branch 1, dokter id, second dentist id */
    private function setUpClinic(): array
    {
        $this->t = CarbonImmutable::now('Asia/Jakarta')->addDays(4)->setTime(10, 0);

        return Ctx::runAs($this->tenantA()->id, function () {
            $doc2 = DatabaseSeeder::user('dokter2@senyum.test', 'drg. Dua Contoh', 'dokter_gigi');
            Membership::create(['user_id' => $doc2->id, 'role' => 'dentist']);
            $chairs = Chair::where('branch_id', Chair::orderBy('label')->value('branch_id'))->orderBy('label')->get();

            return [$chairs, $this->user('dokter@senyum.test')->id, $doc2->id];
        });
    }

    private function book(Chair $chair, string $dentist, int $from = 0, int $len = 30, string $who = 'depan@senyum.test'): string
    {
        return $this->as($who)->postJson('/api/appointments', ['patient_id' => $this->patientOf($this->tenantA())->id, 'chair_id' => $chair->id,
            'dentist_id' => $dentist, 'starts_at' => $this->t->addMinutes($from)->toIso8601String(),
            'ends_at' => $this->t->addMinutes($from + $len)->toIso8601String()])->assertCreated()->json('id');
    }

    private function appt(string $id): Appointment
    {
        return Ctx::runAs($this->tenantA()->id, fn () => Appointment::findOrFail($id));
    }

    private function audit(string $action, string $id): ?AuditEvent
    {
        return Ctx::runAs($this->tenantA()->id, fn () => AuditEvent::where('action', $action)->where('entity_id', $id)->orderByDesc('id')->first());
    }

    public function test_reschedule_cannot_change_the_dentist(): void
    {
        [$chairs, $doc, $doc2] = $this->setUpClinic();
        $id = $this->book($chairs[0], $doc);
        $body = ['starts_at' => $this->t->addHour()->toIso8601String(), 'ends_at' => $this->t->addMinutes(90)->toIso8601String()];
        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/reschedule", [...$body, 'dentist_id' => $doc2])
            ->assertStatus(422)->assertJsonPath('error', 'dentist_locked');
        $this->assertSame($doc, $this->appt($id)->dentist_id);
        $this->assertTrue($this->appt($id)->starts_at->equalTo($this->t)); // nothing moved
        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/reschedule", [...$body, 'dentist_id' => $doc])->assertOk(); // same dentist = fine
        $this->assertSame($doc, $this->appt($id)->dentist_id);
    }

    public function test_change_chair_is_free_but_still_checks_chair_clashes(): void
    {
        [$chairs, $doc, $doc2] = $this->setUpClinic();
        $id = $this->book($chairs[0], $doc);
        $this->book($chairs[2], $doc2); // chair 3 busy at the same time (other dentist)

        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $chairs[1]->id])->assertOk()->assertJsonPath('chair_id', $chairs[1]->id);
        $this->assertSame($chairs[1]->id, $this->appt($id)->chair_id);
        $this->assertSame($doc, $this->appt($id)->dentist_id);
        $this->assertEquals(['from' => $chairs[0]->id, 'to' => $chairs[1]->id], $this->audit('ganti_kursi', $id)->detail);

        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $chairs[2]->id])->assertStatus(409)->assertJsonPath('error', 'chair_busy');
        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $chairs[0]->id, 'dentist_id' => $doc2])
            ->assertStatus(422)->assertJsonPath('error', 'dentist_locked');
        // checked in: still changeable (patient moved to another chair); done: not
        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/transition", ['to' => 'checked_in'])->assertOk();
        $this->as('asisten@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $chairs[0]->id])->assertOk();
        foreach (['in_treatment', 'done'] as $to) {
            $this->as('depan@senyum.test')->postJson("/api/appointments/$id/transition", ['to' => $to])->assertOk();
        }
        $this->as('kasir@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $chairs[1]->id])->assertStatus(409)->assertJsonPath('error', 'not_active');
    }

    public function test_change_chair_rejects_a_chair_of_another_branch(): void
    {
        [$chairs, $doc] = $this->setUpClinic();
        $id = $this->book($chairs[0], $doc);
        $other = Ctx::runAs($this->tenantA()->id, fn () => Chair::where('branch_id', '!=', $chairs[0]->branch_id)->firstOrFail());
        $this->as('pemilik@senyum.test')->postJson("/api/appointments/$id/chair", ['chair_id' => $other->id])->assertStatus(422);
        $this->assertSame($chairs[0]->id, $this->appt($id)->chair_id);
    }

    public function test_refer_is_the_only_dentist_change_reason_required_permission_gated_and_audited(): void
    {
        [$chairs, $doc, $doc2] = $this->setUpClinic();
        $id = $this->book($chairs[0], $doc);
        foreach (['kasir@senyum.test', 'depan@senyum.test', 'asisten@senyum.test'] as $who) { // booking staff cannot refer
            $this->as($who)->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc2, 'reason' => 'Perlu spesialis'])->assertForbidden();
        }
        $this->as('dokter@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc2])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as('dokter@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc, 'reason' => 'Perlu spesialis'])->assertStatus(422);
        $this->assertSame($doc, $this->appt($id)->dentist_id);

        $this->as('dokter@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc2, 'reason' => '  Perlu spesialis bedah mulut '])
            ->assertOk()->assertJsonPath('dentist_id', $doc2);
        $a = $this->appt($id);
        $this->assertSame([$doc2, $chairs[0]->id], [$a->dentist_id, $a->chair_id]);
        $this->assertTrue($a->starts_at->equalTo($this->t)); // same time and chair
        $this->assertEquals(['from_dentist' => $doc, 'to_dentist' => $doc2, 'reason' => 'Perlu spesialis bedah mulut'], $this->audit('rujuk', $id)->detail);

        // the first dentist no longer owns it: cannot refer it again; the owner can (back), the new dentist can
        $this->as('dokter@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc, 'reason' => 'Kembalikan'])->assertForbidden();
        $this->as('pemilik@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc, 'reason' => 'Dokter dua cuti'])->assertOk();
        $this->assertSame($doc, $this->appt($id)->dentist_id);
    }

    public function test_refer_checks_the_new_dentists_clash_and_treatment_state(): void
    {
        [$chairs, $doc, $doc2] = $this->setUpClinic();
        $id = $this->book($chairs[0], $doc);
        $this->book($chairs[1], $doc2, 15); // dentist 2 busy 10:15-10:45
        $this->as('pemilik@senyum.test')->postJson("/api/appointments/$id/refer", ['dentist_id' => $doc2, 'reason' => 'Perlu spesialis'])
            ->assertStatus(409)->assertJsonPath('error', 'dentist_busy');
        $this->assertSame($doc, $this->appt($id)->dentist_id);

        $late = $this->book($chairs[0], $doc, 120);
        foreach (['checked_in', 'in_treatment'] as $to) {
            $this->as('depan@senyum.test')->postJson("/api/appointments/$late/transition", ['to' => $to])->assertOk();
        }
        $this->as('pemilik@senyum.test')->postJson("/api/appointments/$late/refer", ['dentist_id' => $doc2, 'reason' => 'Perlu spesialis'])
            ->assertStatus(409)->assertJsonPath('error', 'not_referable');
    }
}
