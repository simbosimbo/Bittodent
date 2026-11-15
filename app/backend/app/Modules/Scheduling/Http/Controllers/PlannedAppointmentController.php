<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\PlannedAppointment;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use App\Shared\Terminology\OfficialIcdCode;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Planned appointment (Open Dental "Planned"): built at the chair by dentist/assistant, no date; front desk converts it into a real
// appointment ("Perlu dijadwalkan" list). The plan row is kept and linked (appointment_id), never deleted.
class PlannedAppointmentController extends Controller
{
    /** POST /api/patients/{id}/planned-appointments {procedure, procedure_code?, est_minutes, priority?, note?, dentist_id?} */
    public function store(Request $request, string $id, PatientDirectory $patients, TenancyDirectory $tenancy)
    {
        $d = $request->validate([
            'procedure' => ['required', 'string', 'max:200'],
            'procedure_code' => ['bail', 'nullable', 'string', 'regex:/^[0-9]{2}(\.[0-9]{1,2})?$/', OfficialIcdCode::icd9cm()], // ICD-9-CM 2010
            'est_minutes' => ['required', 'integer', 'min:10', 'max:480'],
            'priority' => ['nullable', 'in:normal,segera'],
            'note' => ['nullable', 'string', 'max:500'],
            'dentist_id' => ['nullable', 'uuid'],
        ]);
        $ctx = Ctx::current();
        $patients->assertExists($id);
        $dentist = $d['dentist_id'] ?? $ctx->userId;
        if (! in_array($dentist, $tenancy->dentistIdsForBranch($ctx->branchId), true)) {
            return response()->json(['message' => 'Pilih dokter gigi cabang ini.', 'errors' => ['dentist_id' => ['Dokter gigi tidak ditemukan.']]], 422);
        }
        $p = PlannedAppointment::create([
            'patient_id' => $id, 'branch_id' => $ctx->branchId, 'dentist_id' => $dentist, 'procedure_code' => $d['procedure_code'] ?? null,
            'procedure_enc' => Crypto::encrypt($d['procedure']), 'note_enc' => Crypto::encrypt($d['note'] ?? null),
            'est_minutes' => $d['est_minutes'], 'priority' => $d['priority'] ?? 'normal', 'status' => 'perlu_dijadwalkan', 'created_by' => $ctx->userId,
        ]);
        Audit::log('buat', 'planned_appointment', $p->id);

        return response()->json(self::out($p), 201);
    }

    /** GET /api/planned-appointments?branch_id=: the "Perlu dijadwalkan" list (urgent first, then oldest). */
    public function index(Request $request, PatientDirectory $patients, UserDirectory $users)
    {
        $d = $request->validate(['branch_id' => ['required', 'uuid']]);
        if (! Ctx::current()->coversBranch($d['branch_id'])) {
            return Audit::denied('branch:'.$d['branch_id']);
        }
        $rows = PlannedAppointment::where('branch_id', $d['branch_id'])->where('status', 'perlu_dijadwalkan')
            ->orderByDesc('priority')->orderBy('created_at')->limit(200)->get(); // 'segera' > 'normal'
        $pn = collect($patients->namesByIds($rows->pluck('patient_id')->unique()->values()->all()))->pluck('name', 'id');
        $dn = collect($users->namesByIds($rows->pluck('dentist_id')->unique()->values()->all()))->pluck('name', 'id');

        return response()->json(['data' => $rows->map(fn ($p) => [...self::out($p), 'patient_name' => $pn[$p->patient_id] ?? null,
            'dentist_name' => $dn[$p->dentist_id] ?? null])]);
    }

    /** POST /api/planned-appointments/{id}/schedule {chair_id, starts_at}: idempotent (already scheduled => 200 with the same appointment). */
    public function schedule(Request $request, string $id, AppointmentController $appointments)
    {
        $d = $request->validate(['chair_id' => ['required', 'uuid'], 'starts_at' => ['required', 'date']]);

        return DB::transaction(function () use ($d, $id, $appointments) {
            $p = PlannedAppointment::lockForUpdate()->findOrFail($id); // lock order: plan row, then chair, then dentist
            if (! Ctx::current()->coversBranch($p->branch_id)) {
                return Audit::denied('branch:'.$p->branch_id);
            }
            if ($p->appointment_id) {
                return response()->json(['planned' => self::out($p), 'appointment_id' => $p->appointment_id]);
            }
            $starts = CarbonImmutable::parse($d['starts_at'])->utc();
            $a = $appointments->book($d['chair_id'], $p->dentist_id, $starts, $starts->addMinutes($p->est_minutes));
            if (! $a instanceof Appointment) {
                return $a;
            }
            $a->fill(['patient_id' => $p->patient_id, 'status' => 'booked', 'reason' => 'Dari rencana kunjungan', 'created_by' => Ctx::current()->userId])->save();
            $p->update(['status' => 'dijadwalkan', 'appointment_id' => $a->id, 'scheduled_by' => Ctx::current()->userId]);
            Audit::log('jadwalkan_rencana', 'planned_appointment', $p->id, ['appointment_id' => $a->id]);

            return response()->json(['planned' => self::out($p), 'appointment_id' => $a->id], 201);
        });
    }

    private static function out(PlannedAppointment $p): array
    {
        return [...$p->only(['id', 'patient_id', 'branch_id', 'dentist_id', 'procedure_code', 'est_minutes', 'priority', 'status', 'appointment_id', 'created_at']),
            'procedure' => Crypto::decrypt($p->procedure_enc), 'note' => Crypto::decrypt($p->note_enc)];
    }
}
