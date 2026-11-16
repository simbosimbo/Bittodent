<?php

namespace App\Modules\Scheduling\Services;

use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Modules\Scheduling\Models\Appointment;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use Illuminate\Support\Facades\DB;

final class AppointmentDirectoryService implements AppointmentDirectory
{
    private const VISIT_PATH = ['booked', 'checked_in', 'in_treatment', 'done'];

    public function __construct(private PatientCareSync $care) {}

    public function findOrFail(string $appointmentId): array
    {
        return Appointment::findOrFail($appointmentId)->only(['id', 'patient_id', 'branch_id', 'dentist_id', 'status']);
    }

    public function bookedStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to): array
    {
        return Appointment::where('status', 'booked')->where('starts_at', '>=', $from)->where('starts_at', '<', $to)
            ->orderBy('starts_at')->get(['tenant_id', 'id', 'starts_at'])->map(fn ($a) => ['id' => $a->id, 'starts_at' => $a->starts_at])->all();
    }

    public function cancelledStartingBetween(\DateTimeInterface $from, \DateTimeInterface $to, ?array $branchIds): array
    {
        return Appointment::whereIn('status', ['cancelled', 'no_show'])->where('starts_at', '>=', $from)->where('starts_at', '<', $to)
            ->when($branchIds !== null, fn ($q) => $q->whereIn('branch_id', $branchIds))->get()
            ->map(fn ($a) => ['id' => $a->id, 'patient_id' => $a->patient_id, 'dentist_id' => $a->dentist_id, 'status' => $a->status,
                'starts_at' => $a->starts_at->toIso8601ZuluString()])->all();
    }

    public function complaint(string $appointmentId): ?string
    {
        $a = Appointment::findOrFail($appointmentId);

        return Crypto::decrypt($a->complaint_enc) ?? $a->reason;
    }

    public function advance(string $appointmentId, string $to): void
    {
        DB::transaction(function () use ($appointmentId, $to) {
            $a = Appointment::lockForUpdate()->findOrFail($appointmentId);
            $at = array_search($a->status, self::VISIT_PATH, true);
            $target = array_search($to, self::VISIT_PATH, true);
            if ($at === false || $at >= $target) {
                return;
            }
            while ($at < $target) {
                $from = $a->status;
                $next = self::VISIT_PATH[++$at];
                $a->update(['status' => $next, AppointmentStatus::STAMPS[$next] => now()]);
                Audit::log('ubah_status', 'appointment', $a->id, ['from' => $from, 'to' => $next, 'via' => 'kunjungan']);
            }
            $this->care->push($a->patient_id);
        });
    }
}
