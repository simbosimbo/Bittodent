<?php

namespace App\Modules\Clinical\Listeners;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\VisitCloser;
use App\Modules\Scheduling\Events\AppointmentCompleting;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Exceptions\HttpResponseException;
use LogicException;

// Unit 4: appointment -> done closes its open visit under the same guard; a refusal aborts the transition (exception rolls back).
// #55: an already `selesai` visit is a no-op; unsigned clinical work is refused (use_selesai) so done never bypasses Selesai.
final class CloseVisitOnAppointmentDone
{
    public function __construct(private VisitCloser $closer) {}

    public function handle(AppointmentCompleting $e): void
    {
        if ($e->tenantId !== Ctx::current()->tenant()) {
            throw new LogicException('AppointmentCompleting dari tenant lain.');
        }
        $v = Visit::lockForUpdate()->where('appointment_id', $e->appointmentId)->where('status', 'berlangsung')->first();
        if ($v && $error = $this->closer->close($v, null, 'janji_selesai')) {
            throw new HttpResponseException($error);
        }
    }
}
