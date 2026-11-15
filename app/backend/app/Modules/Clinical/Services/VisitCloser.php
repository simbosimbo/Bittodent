<?php

namespace App\Modules\Clinical\Services;

use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Events\VisitClosing;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Unit 4 (DEVIATIONS #50): the one way a visit becomes `selesai` (Selesai, POST /visits/{id}/close and appointment -> done).
// #55: unsigned clinical work is refused (409 use_selesai) unless attendance was cancelled; Selesai signs first, then calls close().
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
        if (! $cancelled && self::needsSelesai($v)) {
            Audit::log('tutup_ditolak', 'visit', $v->id, ['reason' => 'use_selesai', 'via' => $via]);

            return response()->json(['error' => 'use_selesai',
                'message' => 'Kunjungan ini punya catatan atau tindakan yang belum Selesai. Dokter penanggung jawab harus menekan Selesai.'], 409);
        }
        $event = new VisitClosing(Ctx::current()->tenant(), $v->id, $this->completedProcedureIds($v));
        event($event);
        if ($event->blocked() && ! $cancelled) {
            Audit::log('tutup_ditolak', 'visit', $v->id, ['reason' => 'invoice_required', 'procedures' => $event->unbilledProcedureIds, 'via' => $via]);

            return response()->json(['error' => 'invoice_required', 'procedure_ids' => $event->unbilledProcedureIds,
                'message' => 'Kunjungan dengan tindakan selesai tidak bisa ditutup tanpa tagihan. Pastikan setiap tindakan selesai punya baris tagihan (cek tarif), lalu tekan Selesai lagi.'], 409);
        }
        $v->update(['status' => 'selesai', 'ended_at' => now(), 'closed_by' => Ctx::current()->userId,
            'close_reason' => $cancelled ? trim($reason) : null, 'closed_without_invoice' => $event->blocked()]);
        Audit::log('tutup', 'visit', $v->id, ['via' => $via, 'attendance_cancelled' => $cancelled, 'without_invoice' => $event->blocked()]);

        return null;
    }

    /** Unsigned clinical work (draft note version, draft finding or draft procedure): only the DPJP's Selesai may close (#55). */
    public static function needsSelesai(Visit $v): bool
    {
        return ClinicalNoteVersion::whereIn('note_id', ClinicalNote::where('visit_id', $v->id)->select('id'))->where('state', 'draft')->exists()
            || ToothFinding::where('visit_id', $v->id)->where('state', 'draft')->exists()
            || ProcedureRecord::where('visit_id', $v->id)->where('state', 'draft')->exists();
    }

    public function attendanceCancelled(Visit $v): bool
    {
        return $v->attendance_cancelled_at !== null
            || ($v->appointment_id !== null && in_array($this->appointments->findOrFail($v->appointment_id)['status'], ['cancelled', 'no_show'], true));
    }

    /**
     * `selesai` work with a code, draft or final (an unsigned draft has no line yet, so it blocks too). A correction of a `selesai` row
     * is a new `selesai` row that is never billed (the line stays on the original): skip rows that supersede a `selesai` row.
     * Unit B: work later corrected to `tidak_dikerjakan` is not completed work (never needs a line; if it was billed, Billing blocks
     * the close until the linked full credit note is decided). Also the owner integrity report's "tanpa tagihan" base (IntegrityFactsService).
     */
    public static function completedProcedures()
    {
        $selesai = fn ($q) => $q->whereIn('state', ['draft', 'final'])->where('status', ProcedureStatus::BILLABLE);

        return ProcedureRecord::where($selesai)->whereNotNull('procedure_code')
            ->where(fn ($q) => $q->whereNull('supersedes_id')->orWhereNotIn('supersedes_id', ProcedureRecord::where($selesai)->select('id')))
            ->whereNotIn('id', self::notDoneChainIds());
    }

    /**
     * Rows of correction chains that end in `tidak_dikerjakan`.
     * shortcut: loads every tidak_dikerjakan row of the tenant and walks back in PHP; fine while they are rare, move to a stored chain root when not.
     *
     * @return list<string>
     */
    private static function notDoneChainIds(): array
    {
        $ids = [];
        foreach (ProcedureRecord::where('state', 'final')->where('status', ProcedureStatus::NOT_DONE)->get() as $p) {
            $ids = [...$ids, ...array_map(fn ($r) => $r->id, $p->correctionChain())];
        }

        return $ids;
    }

    /** @return list<string> */
    private function completedProcedureIds(Visit $v): array
    {
        return self::completedProcedures()->where('visit_id', $v->id)->pluck('id')->all();
    }
}
