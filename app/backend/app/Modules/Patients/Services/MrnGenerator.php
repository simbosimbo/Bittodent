<?php

namespace App\Modules\Patients\Services;

use App\Modules\Patients\Models\Patient;
use App\Modules\Patients\Models\PatientMrnSeq;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\DB;

// No. RM (medical record number): "BT-" + 6 zero-padded digits, sequential per tenant from BT-000001 (docs/database.md 3.2).
// Allocation: SELECT ... FOR UPDATE on the tenant's patient_mrn_seq row, so concurrent creates queue on that row.
// Call inside the patient-insert transaction: the lock (and the number) then commit or roll back with the patient.
// Unique (tenant_id, mrn) is the last line of defence; numbers already taken (e.g. manual fixes) are skipped.
final class MrnGenerator
{
    public static function format(int $n): string
    {
        return sprintf('BT-%06d', $n);
    }

    public static function next(): string
    {
        return DB::transaction(function () {
            $seq = PatientMrnSeq::query()->lockForUpdate()->first();
            if ($seq === null) { // first patient of a new tenant; INSERT IGNORE-style so two first creates don't collide
                PatientMrnSeq::query()->insertOrIgnore(['tenant_id' => Ctx::current()->tenant(), 'next_n' => 1, 'created_at' => now(), 'updated_at' => now()]);
                $seq = PatientMrnSeq::query()->lockForUpdate()->firstOrFail();
            }
            do {
                $mrn = self::format($seq->next_n++);
            } while (Patient::where('mrn', $mrn)->exists());
            $seq->save();

            return $mrn;
        });
    }
}
