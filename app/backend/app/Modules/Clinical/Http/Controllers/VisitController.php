<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\VisitCloser;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Unit 4: close a visit (invoice guard) and cancel a walk-in's attendance. Route perm appointment.transition: whoever may dismiss
// the appointment may close its visit (owner, dentist, assistant, front desk; not kasir).
class VisitController extends Controller
{
    /** POST /api/visits/{id}/close {reason?}: reason required only when attendance was cancelled. */
    public function close(Request $request, string $id, VisitCloser $closer)
    {
        $d = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return $this->locked($id, fn (Visit $v) => $closer->close($v, $d['reason'] ?? null, 'kunjungan') ?? response()->json(self::out($v)));
    }

    /** POST /api/visits/{id}/cancel-attendance {reason}: walk-in only (appointment visits use appointment cancelled/no_show). */
    public function cancelAttendance(Request $request, string $id)
    {
        $d = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']]);

        return $this->locked($id, function (Visit $v) use ($d) {
            if ($v->appointment_id !== null) {
                return response()->json(['error' => 'has_appointment', 'message' => 'Kunjungan ini dari janji: batalkan lewat status janji (batal/tidak datang).'], 422);
            }
            if ($v->attendance_cancelled_at !== null) {
                return response()->json(['error' => 'already_cancelled', 'message' => 'Kehadiran sudah dibatalkan.'], 409);
            }
            $v->update(['attendance_cancelled_at' => now(), 'attendance_cancelled_by' => Ctx::current()->userId, 'attendance_cancel_reason' => trim($d['reason'])]);
            Audit::log('batal_hadir', 'visit', $v->id);

            return response()->json(self::out($v));
        });
    }

    private function locked(string $id, callable $fn): JsonResponse
    {
        return DB::transaction(function () use ($id, $fn) {
            $v = Visit::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($v->branch_id)) {
                return Audit::denied('branch:'.$v->branch_id);
            }
            if ($v->status !== 'berlangsung') {
                return response()->json(['error' => 'visit_closed', 'message' => 'Kunjungan sudah ditutup.'], 409);
            }

            return $fn($v);
        });
    }

    public static function out(Visit $v): array
    {
        return $v->only(['id', 'patient_id', 'branch_id', 'dentist_id', 'appointment_id', 'started_at', 'ended_at', 'status',
            'closed_without_invoice', 'attendance_cancelled_at']);
    }
}
