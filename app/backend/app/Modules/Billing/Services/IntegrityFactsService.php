<?php

namespace App\Modules\Billing\Services;

use App\Modules\Billing\Contracts\IntegrityFacts;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceAdjustment;
use App\Modules\Billing\Models\InvoiceAdjustmentDecision;
use App\Modules\Billing\Models\InvoiceLine;

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

        return $lines->map(fn ($l) => ['procedure_id' => $l->procedure_id, 'doctor_id' => $l->doctor_id, 'visit_id' => $inv[$l->invoice_id]->visit_id,
            'patient_id' => $inv[$l->invoice_id]->patient_id, 'created_at' => $l->created_at->toIso8601ZuluString()])->values()->all();
    }

    private function invoices(?array $branchIds)
    {
        return Invoice::query()->when($branchIds !== null, fn ($q) => $q->whereIn('branch_id', $branchIds));
    }
}
