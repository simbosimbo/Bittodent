<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Events\VisitClosing;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Unit 4 (DEVIATIONS #50): the one way a visit becomes `selesai` (POST /visits/{id}/close and appointment -> done).
// Completed work needs an invoice line (Billing answers via VisitClosing). Only exception (Yohanes, 15 Nov 2026): attendance
// cancelled (appointment cancelled/no_show, or walk-in "batalkan kehadiran") => may close without invoice, reason required.
final class VisitCloser
{
    public function __construct(private AppointmentDirectory $appointments) {}

    /** Call inside a transaction with $v locked and status `berlangsung`. Returns an error response, or null when closed. */
    public function close(Visit $v, ?string $reason, string $via): ?JsonResponse
    {
        $cancelled = $this->attendanceCancelled($v);
        if ($cancelled && mb_strlen(trim((string) $reason)) < 10) {
            return response()->json(['message' => 'Kehadiran dibatalkan: alasan menutup kunjungan wajib diisi (min. 10 karakter).',
                'errors' => ['reason' => ['Alasan wajib diisi (min. 10 karakter).']]], 422);
        }
        $event = new VisitClosing(Ctx::current()->tenant(), $v->id, $this->completedProcedureIds($v));
        event($event);
        if ($event->blocked() && ! $cancelled) {
            Audit::log('tutup_ditolak', 'visit', $v->id, ['reason' => 'invoice_required', 'procedures' => $event->unbilledProcedureIds, 'via' => $via]);

            return response()->json(['error' => 'invoice_required', 'procedure_ids' => $event->unbilledProcedureIds,
                'message' => 'Kunjungan dengan tindakan selesai tidak bisa ditutup tanpa tagihan. Tandatangani catatan dan pastikan setiap tindakan selesai punya baris tagihan (cek tarif).'], 409);
        }
        $v->update(['status' => 'selesai', 'ended_at' => now(), 'closed_by' => Ctx::current()->userId,
            'close_reason' => $cancelled ? trim($reason) : null, 'closed_without_invoice' => $event->blocked()]);
        Audit::log('tutup', 'visit', $v->id, ['via' => $via, 'attendance_cancelled' => $cancelled, 'without_invoice' => $event->blocked()]);

        return null;
    }

    public function attendanceCancelled(Visit $v): bool
    {
        return $v->attendance_cancelled_at !== null
            || ($v->appointment_id !== null && in_array($this->appointments->findOrFail($v->appointment_id)['status'], ['cancelled', 'no_show'], true));
    }

    /**
     * `selesai` work with a code, draft or final (an unsigned draft has no line yet, so it blocks too). A correction of a `selesai` row
     * is a new `selesai` row that is never billed (the line stays on the original): skip rows that supersede a `selesai` row.
     *
     * @return list<string>
     */
    private function completedProcedureIds(Visit $v): array
    {
        $selesai = fn ($q) => $q->whereIn('state', ['draft', 'final'])->where('status', ProcedureStatus::BILLABLE);

        return ProcedureRecord::where('visit_id', $v->id)->where($selesai)->whereNotNull('procedure_code')
            ->where(fn ($q) => $q->whereNull('supersedes_id')->orWhereNotIn('supersedes_id', ProcedureRecord::where($selesai)->select('id')))
            ->pluck('id')->all();
    }
}
