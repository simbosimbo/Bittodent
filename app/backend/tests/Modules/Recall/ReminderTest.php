<?php

namespace Tests\Modules\Recall;

use App\Modules\Recall\Models\ReminderLog;
use App\Modules\Recall\Services\ReminderService;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Tests\TestCase;

// Reminder idempotency across reschedules. Time is passed in explicitly; appointments are moved through the real API.
class ReminderTest extends TestCase
{
    private CarbonImmutable $t; // original appointment start

    private string $id;

    protected function setUp(): void
    {
        parent::setUp();
        $this->t = CarbonImmutable::parse('2030-04-10T03:00:00Z');
        $this->id = $this->inA(function () {
            $tpl = Appointment::where('status', 'booked')->orderBy('starts_at')->firstOrFail();

            return Appointment::create([...$tpl->only(['branch_id', 'chair_id', 'dentist_id', 'patient_id']), 'starts_at' => $this->t,
                'ends_at' => $this->t->addMinutes(30), 'status' => 'booked'])->id;
        });
    }

    private function inA(callable $fn): mixed
    {
        return Ctx::runAs($this->tenantA()->id, $fn);
    }

    /** @return list<string> kinds sent at $now for the test appointment */
    private function due(CarbonImmutable $now): array
    {
        return collect($this->inA(fn () => app(ReminderService::class)->sendDue($now)))->where('appointment_id', $this->id)->pluck('kind')->all();
    }

    private function moveTo(CarbonImmutable $start, ?string $chair = null): void
    {
        $this->as('depan@senyum.test')->postJson("/api/appointments/{$this->id}/reschedule", array_filter(['starts_at' => $start->toIso8601ZuluString(),
            'ends_at' => $start->addMinutes(30)->toIso8601ZuluString(), 'chair_id' => $chair]))->assertOk();
    }

    private function logs(): int
    {
        return $this->inA(fn () => ReminderLog::where('appointment_id', $this->id)->count());
    }

    public function test_sent_once_per_slot(): void
    {
        $this->assertSame([], $this->due($this->t->subHours(25)));
        $this->assertSame(['h_minus_1'], $this->due($this->t->subHours(24)));
        $this->assertSame([], $this->due($this->t->subHours(23))); // second run: nothing
        $this->assertSame(['h_minus_2jam'], $this->due($this->t->subHours(2)));
        $this->assertSame([], $this->due($this->t->subHour()));
        $this->assertSame(2, $this->logs());
        $l = $this->inA(fn () => ReminderLog::where('appointment_id', $this->id)->where('kind', 'h_minus_1')->firstOrFail());
        $this->assertSame(['noop', $this->t->subDay()->toIso8601ZuluString()], [$l->channel, $l->scheduled_for->toIso8601ZuluString()]);
    }

    public function test_reschedule_to_same_time_or_back_does_not_resend(): void
    {
        $this->due($this->t->subHours(24));
        $other = $this->inA(fn () => Chair::where('id', '!=', Appointment::findOrFail($this->id)->chair_id)
            ->where('branch_id', Appointment::findOrFail($this->id)->branch_id)->firstOrFail()->id);
        $this->moveTo($this->t, $other); // chair change only: same slot
        $this->assertSame([], $this->due($this->t->subHours(23)));

        $this->moveTo($this->t->addHours(3)); // new time: new h-1 due at t-21h
        $this->assertSame(['h_minus_1'], $this->due($this->t->subHours(21)));
        $this->moveTo($this->t); // back to the first slot: already reminded
        $this->assertSame([], $this->due($this->t->subHours(20)));
        $this->assertSame(2, $this->logs());
    }

    public function test_resend_after_move_respects_minimum_gap_policy(): void
    {
        $this->due($this->t->subHours(24));
        $this->moveTo($this->t->addMinutes(30)); // due t-23h30, only 30 min after the last send
        $this->assertSame([], $this->due($this->t->subHours(24)->addMinutes(30)));
        $this->assertSame(['h_minus_1'], $this->due($this->t->subHours(24)->addMinutes(61)));
        $this->assertSame(2, $this->logs());
    }

    public function test_cancelled_appointment_gets_nothing(): void
    {
        $this->as('depan@senyum.test')->postJson("/api/appointments/{$this->id}/transition", ['to' => 'cancelled'])->assertOk();
        $this->assertSame([], $this->due($this->t->subHours(24)));
    }
}
