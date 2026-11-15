<?php

namespace App\Modules\Billing\Services;

use App\Modules\Billing\Contracts\RevenueFacts;
use App\Modules\Billing\Models\CashShift;
use App\Modules\Billing\Models\Invoice;
use App\Modules\Billing\Models\InvoiceLine;
use App\Modules\Billing\Models\InvoicePayment;
use App\Modules\Billing\Models\PaymentAccount;

final class RevenueFactsService implements RevenueFacts
{
    public function payments(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array
    {
        $pays = InvoicePayment::where('paid_at', '>=', $from)->where('paid_at', '<', $to)
            ->whereIn('invoice_id', Invoice::where('branch_id', $branchId)->select('id'))->get(['payment_account_id', 'amount_rp', 'paid_at']);
        $acc = PaymentAccount::whereIn('id', $pays->pluck('payment_account_id')->unique())->get()->keyBy('id');

        return $pays->map(fn ($p) => ['paid_at' => $p->paid_at->toIso8601ZuluString(), 'kind' => $acc[$p->payment_account_id]->kind,
            'bank_name' => $acc[$p->payment_account_id]->bank_name, 'amount_rp' => (int) $p->amount_rp])->values()->all();
    }

    public function lines(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array
    {
        $lines = InvoiceLine::where('created_at', '>=', $from)->where('created_at', '<', $to)
            ->whereIn('invoice_id', Invoice::where('branch_id', $branchId)->select('id'))->get(['invoice_id', 'doctor_id', 'procedure_name', 'procedure_code', 'price_rp']);
        $patients = Invoice::whereIn('id', $lines->pluck('invoice_id')->unique())->pluck('patient_id', 'id');

        return $lines->map(fn ($l) => ['doctor_id' => $l->doctor_id, 'patient_id' => $patients[$l->invoice_id],
            'procedure_name' => $l->procedure_name ?? $l->procedure_code, 'price_rp' => (int) $l->price_rp])->values()->all();
    }

    public function receivables(string $branchId): array
    {
        $open = Invoice::where('branch_id', $branchId)->where('status', 'terbuka')->orderBy('created_at')->limit(500)->get();
        $items = InvoiceLine::whereIn('invoice_id', $open->pluck('id'))->get(['invoice_id', 'procedure_name', 'procedure_code'])->groupBy('invoice_id');

        return $open->map(fn ($i) => ['patient_id' => $i->patient_id, 'created_at' => $i->created_at->toIso8601ZuluString(),
            'balance_rp' => Ledger::totals($i)['balance_rp'],
            'items' => ($items[$i->id] ?? collect())->map(fn ($l) => $l->procedure_name ?? $l->procedure_code)->unique()->values()->all()])
            ->filter(fn ($r) => $r['balance_rp'] > 0)->values()->all();
    }

    public function shiftDifferences(\DateTimeInterface $from, \DateTimeInterface $to, string $branchId): array
    {
        return CashShift::where('branch_id', $branchId)->where('closed_at', '>=', $from)->where('closed_at', '<', $to)->where('difference_rp', '!=', 0)
            ->orderBy('closed_at')->get()->map(fn ($s) => ['user_id' => $s->user_id, 'closed_at' => $s->closed_at->toIso8601ZuluString(),
                'difference_rp' => $s->difference_rp, 'reason' => $s->reason])->values()->all();
    }
}
