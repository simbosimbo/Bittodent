<?php

namespace App\Modules\Recall\Services;

use App\Modules\Recall\Models\ReminderLog;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;

// Appointment reminders, logged in reminder_log (append-only) so the same reminder is never sent twice.
// Idempotency key = appointment + kind + scheduled_for (due time derived from the appointment start):
// - rescheduled to the SAME slot (or back to a slot already reminded) => same key => no resend;
// - moved to a different time => new key => resend allowed if policy allows (MIN_GAP since the last send of that kind).
// Channel is a no-op: nothing leaves the system yet (real WhatsApp later via outbox, only with consent + approved template, D-011).
// Runs per tenant: the caller sets Ctx (routes/console.php recall:send-reminders).
final class ReminderService
{
    /** kind => minutes before the appointment start */
    public const KINDS = ['h_minus_1' => 24 * 60, 'h_minus_2jam' => 120];

    /** Policy: never send the same kind for one appointment twice within this many minutes (e.g. repeated reschedules). */
    public const MIN_GAP_MINUTES = 60;

    public const CHANNEL = 'noop';

    public function __construct(private AppointmentDirectory $appointments) {}

    /** Sends every due reminder at $now. @return list<ReminderLog> newly sent */
    public function sendDue(CarbonImmutable $now): array
    {
        $sent = [];
        $upcoming = $this->appointments->bookedStartingBetween($now, $now->addMinutes(max(self::KINDS) + 1));
        $logs = ReminderLog::whereIn('appointment_id', array_column($upcoming, 'id'))->get()->groupBy(fn ($l) => $l->appointment_id.'|'.$l->kind);
        foreach ($upcoming as $a) {
            $starts = CarbonImmutable::instance($a['starts_at']);
            foreach (self::KINDS as $kind => $minutes) {
                $due = $starts->subMinutes($minutes);
                if ($now->lt($due)) {
                    continue;
                }
                $prior = $logs->get($a['id'].'|'.$kind, collect());
                if ($prior->contains(fn ($l) => $l->scheduled_for->equalTo($due))) {
                    continue; // this slot was already reminded
                }
                if ($prior->contains(fn ($l) => $l->sent_at->gt($now->subMinutes(self::MIN_GAP_MINUTES)))) {
                    continue; // policy: too soon after the previous send of this kind
                }
                try {
                    $sent[] = ReminderLog::create(['appointment_id' => $a['id'], 'kind' => $kind, 'channel' => self::CHANNEL,
                        'scheduled_for' => $due, 'appointment_starts_at' => $starts, 'sent_at' => $now]);
                } catch (UniqueConstraintViolationException) {
                    // a parallel run logged it first: it counts as sent once
                }
            }
        }

        return $sent;
    }
}
