<?php

namespace App\Modules\Billing\Services;

use App\Modules\Billing\Contracts\IntegrityFacts;
use App\Modules\Billing\Models\BillingDecision;
use App\Modules\Billing\Models\CreditNote;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoiceRefund;
use App\Modules\Billing\Models\InvoiceVoid;
use App\Modules\Billing\Models\LineCorrection;

final class IntegrityFactsService implements IntegrityFacts
{
    public function billedProcedureIds(array $procedureIds): array
    {
        return $procedureIds === [] ? [] : InvoiceLine::whereIn('procedure_id', $procedureIds)->pluck('procedure_id')->all();
    }

    public function adjustments(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $adj = InvoiceAdjustment::whereIn('kind', ['discount', 'write_off'])->where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->whereIn('invoice_id', $this->invoices($branchIds)->select('id'))->get();
        $inv = Invoice::whereIn('id', $adj->pluck('invoice_id')->unique())->get()->keyBy('id');
        $dec = InvoiceAdjustmentDecision::whereIn('adjustment_id', $adj->pluck('id'))->get()->keyBy('adjustment_id');

        return $adj->map(function ($a) use ($inv, $dec) {
            $d = $dec->get($a->id);

            return ['id' => $a->id, 'invoice_id' => $a->invoice_id, 'visit_id' => $inv[$a->invoice_id]->visit_id,
                'patient_id' => $inv[$a->invoice_id]->patient_id, 'kind' => $a->kind, 'amount_rp' => $a->amount_rp,
                'created_at' => $a->created_at->toIso8601ZuluString(), 'zero' => $a->requires_approval,
                'status' => ! $a->requires_approval ? 'applied' : ($d->decision ?? 'pending'),
                'decided_at' => $d?->created_at?->toIso8601ZuluString(), 'self_approved_sole_owner' => (bool) $d?->self_approved_sole_owner];
        })->values()->all();
    }

    public function zeroPriceLines(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $lines = InvoiceLine::where('price_rp', 0)->where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->whereIn('invoice_id', $this->invoices($branchIds)->select('id'))->get();
        $inv = Invoice::whereIn('id', $lines->pluck('invoice_id')->unique())->get()->keyBy('id');
        $ok = BillingDecision::whereIn('invoice_line_id', $lines->pluck('id'))->pluck('decision', 'invoice_line_id');

        return $lines->map(fn ($l) => ['id' => $l->id, 'procedure_id' => $l->procedure_id, 'procedure_code' => $l->procedure_code,
            'doctor_id' => $l->doctor_id, 'invoice_id' => $l->invoice_id, 'visit_id' => $inv[$l->invoice_id]->visit_id,
            'patient_id' => $inv[$l->invoice_id]->patient_id, 'created_at' => $l->created_at->toIso8601ZuluString(),
            'tariff_status' => $l->tariff_zero ? ($ok[$l->id] ?? 'pending') : null])->values()->all();
    }

    public function linePricesByProcedure(array $procedureIds): array
    {
        return $procedureIds === [] ? [] : InvoiceLine::whereIn('procedure_id', $procedureIds)->get()
            ->groupBy('procedure_id')->map(fn ($g) => (int) $g->sum('price_rp'))->all();
    }

    public function reversals(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $in = fn ($q) => $q->where('created_at', '>=', $from)->where('created_at', '<', $to)->whereIn('invoice_id', $this->invoices($branchIds)->select('id'));
        $notes = CreditNote::where($in)->get();
        $voids = InvoiceVoid::where($in)->get();
        $refunds = InvoiceRefund::where($in)->get();
        $refundNotes = CreditNote::whereIn('id', $refunds->pluck('credit_note_id'))->get()->keyBy('id');
        $inv = Invoice::whereIn('id', $notes->pluck('invoice_id')->merge($voids->pluck('invoice_id'))->merge($refunds->pluck('invoice_id'))->unique())
            ->get()->keyBy('id');
        $lines = InvoiceLine::whereIn('id', $notes->pluck('invoice_line_id')->merge($refundNotes->pluck('invoice_line_id')))->get()->keyBy('id');
        $voidRp = InvoiceLine::whereIn('invoice_id', $voids->pluck('invoice_id'))->get()->groupBy('invoice_id')->map(fn ($g) => (int) $g->sum('price_rp'));
        $bd = BillingDecision::whereIn('credit_note_id', $notes->pluck('id'))->orWhereIn('invoice_void_id', $voids->pluck('id'))
            ->orWhereIn('refund_id', $refunds->pluck('id'))->get();
        $row = function ($r, string $kind, string $fk, bool $needsOwner, ?string $doctor, int $amount, bool $full, ?string $number) use ($inv, $bd) {
            $d = $bd->firstWhere($fk, $r->id);

            return ['id' => $r->id, 'kind' => $kind, 'invoice_id' => $r->invoice_id, 'visit_id' => $inv[$r->invoice_id]->visit_id,
                'patient_id' => $inv[$r->invoice_id]->patient_id, 'doctor_id' => $doctor, 'amount_rp' => $amount, 'is_full' => $full,
                'number' => $number, 'status' => ! $needsOwner ? 'applied' : ($d->decision ?? 'pending'), 'created_at' => $r->created_at->toIso8601ZuluString(),
                'decided_at' => $d?->created_at?->toIso8601ZuluString(), 'self_approved_sole_owner' => (bool) $d?->self_approved_sole_owner];
        };

        return [
            'credit_notes' => $notes->map(fn ($n) => $row($n, 'nota_kredit', 'credit_note_id', $n->requires_approval,
                $lines[$n->invoice_line_id]->doctor_id ?? null, $n->amount_rp, $n->is_full, $n->number))->values()->all(),
            'voids' => $voids->map(fn ($v) => $row($v, 'void', 'invoice_void_id', $v->requires_approval, null,
                $voidRp[$v->invoice_id] ?? 0, true, null))->values()->all(),
            'refunds' => $refunds->map(fn ($r) => $row($r, 'refund', 'refund_id', true, // refunds always wait for an owner (#57)
                $lines[$refundNotes[$r->credit_note_id]->invoice_line_id]->doctor_id ?? null, $r->amount_rp, false,
                $refundNotes[$r->credit_note_id]->number))->values()->all(),
        ];
    }

    public function lineCorrections(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        $flags = LineCorrection::where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->whereIn('invoice_id', $this->invoices($branchIds)->select('id'))->get();
        $invIds = $flags->pluck('invoice_id')->unique();
        $inv = Invoice::whereIn('id', $invIds)->get()->keyBy('id');
        $lines = InvoiceLine::whereIn('invoice_id', $invIds)->get();
        $notes = CreditNote::whereIn('invoice_id', $invIds)->get();
        $bd = BillingDecision::whereIn('credit_note_id', $notes->pluck('id'))->orWhereIn('line_correction_id', $flags->pluck('id'))->get();
        $live = $notes->reject(fn ($n) => $bd->firstWhere('credit_note_id', $n->id)?->decision === 'rejected');
        $billed = $lines->pluck('procedure_id')->all();

        return $flags->map(fn ($r) => ['id' => $r->id, 'invoice_id' => $r->invoice_id, 'visit_id' => $inv[$r->invoice_id]->visit_id,
            'patient_id' => $inv[$r->invoice_id]->patient_id, 'doctor_id' => $lines->firstWhere('id', $r->invoice_line_id)?->doctor_id,
            'reason_type' => $r->reason_type, 'created_at' => $r->created_at->toIso8601ZuluString(),
            'handled' => Ledger::reviewed($r, $live, $bd, $billed)])->values()->all();
    }

    private function invoices(?array $branchIds)
    {
        return Invoice::query()->when($branchIds !== null, fn ($q) => $q->whereIn('branch_id', $branchIds));
    }
}
