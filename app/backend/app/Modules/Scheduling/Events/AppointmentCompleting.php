<?php

namespace App\Modules\Scheduling\Events;

// Dispatched (sync, inside the transition transaction) before an appointment moves to `done`. Clinical listens and closes the
// linked visit under the invoice guard; an exception from a listener rolls the transition back (unit 4).
final class AppointmentCompleting
{
    public function __construct(public readonly string $tenantId, public readonly string $appointmentId) {}
}
