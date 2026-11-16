<?php

namespace Tests\Feature;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\VisitCloser;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tariffs\Models\Tariff;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;

// Audit S9: the reconciliation queries R1-R7 (docs/audit/2026-11-16-alur-erm.md, "Query rekonsiliasi") as one assertion.
// Each check returns the offending ids, so a failure names the broken invariant and the rows.
trait AssertsReconciled
{
    /** R1-R6 for every tenant. R7 is configuration, not an invariant (S1 lets an owner leave a procedure unpriced): see unpricedMappedCodes(). */
    protected function assertReconciled(): void
    {
        $breaks = [];
        foreach (Tenant::pluck('name', 'id') as $id => $name) {
            foreach (array_filter(Ctx::runAs($id, fn () => $this->reconciliationBreaks())) as $check => $ids) {
                $breaks["$name: $check"] = $ids;
            }
        }
        $this->assertSame([], $breaks, 'Rekonsiliasi tidak nol: '.json_encode($breaks, JSON_PRETTY_PRINT));
    }

    /** @return array<string, list<string>> check name => offending ids; run inside Ctx::runAs. */
    private function reconciliationBreaks(): array
    {
        // VisitCloser::attendanceCancelled: the only visits that may close without billing (walk-in batal hadir, appointment cancelled/no_show)
        $cancelled = Visit::where(fn ($q) => $q->whereNotNull('attendance_cancelled_at')
            ->orWhereIn('appointment_id', Appointment::whereIn('status', ['cancelled', 'no_show'])->select('id')))->pluck('id')->all();
        // completed work as VisitCloser counts it (corrections and tidak_dikerjakan chains excluded) with no invoice line
        $unbilled = fn () => VisitCloser::completedProcedures()->whereNotIn('id', InvoiceLine::whereNotNull('procedure_id')->select('procedure_id'));
        // S1: signed work whose price the owner has not set yet keeps the visit open ("menunggu harga"), its invoice empty
        $waiting = Visit::where('status', 'berlangsung')->whereIn('id', $unbilled()->where('state', 'final')->select('visit_id'))->pluck('id')->all();
        $selesai = Visit::where('status', 'selesai')->whereNotIn('id', $cancelled);

        $checks = [
            'R1 kunjungan selesai, tindakan selesai berkode tanpa baris tagihan' => $unbilled()->whereIn('visit_id', (clone $selesai)->select('id'))->pluck('id'),
            'R2 tindakan selesai tanpa kode' => ProcedureRecord::where('state', 'final')->where('status', ProcedureStatus::BILLABLE)->whereNull('procedure_code')->pluck('id'),
            'R3 kunjungan selesai, janji belum done' => (clone $selesai)->whereIn('appointment_id', Appointment::where('status', '<>', 'done')->select('id'))->pluck('id'),
            'R4 catatan ditandatangani, kunjungan masih berlangsung' => Visit::where('status', 'berlangsung')->whereNotIn('id', $waiting)
                ->whereIn('id', ClinicalNote::whereIn('id', ClinicalNoteVersion::whereNotNull('signed_at')->select('note_id'))->select('visit_id'))->pluck('id'),
            'R5 tagihan tanpa baris' => Invoice::whereNotIn('id', InvoiceLine::select('invoice_id'))->whereNotIn('visit_id', [...$waiting, ...$cancelled])->pluck('id'),
            'R6 kunjungan selesai tanpa tagihan' => (clone $selesai)->whereNotIn('id', Invoice::select('visit_id'))->pluck('id'),
        ];

        return array_map(fn ($ids) => collect($ids)->values()->all(), $checks);
    }

    /** R7: catalog codes mapped to an odontogram condition with no tariff at all, sorted; run inside Ctx::runAs. */
    protected function unpricedMappedCodes(): array
    {
        $priced = Tariff::pluck('procedure_code')->all();

        return ProcedureDefinition::get()->filter(fn ($d) => ! empty($d->conditions) && ! in_array($d->procedure_code, $priced, true))
            ->pluck('procedure_code')->sort()->values()->all();
    }
}
