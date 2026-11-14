<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Modules\Scheduling\Http\Requests\StoreAppointmentRequest;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Fluent;

class AppointmentController extends Controller
{
    public function __construct(private TenancyDirectory $tenancy, private PatientDirectory $patients, private UserDirectory $users) {}

    /** Chairs of one branch with that local day's appointments; patient/dentist names via other modules' Contracts (constant query count). */
    public function schedule(Request $request)
    {
        $d = $request->validate(['branch_id' => ['required', 'uuid'], 'date' => ['required', 'date_format:Y-m-d']]);
        $branch = $this->tenancy->branchOrFail($d['branch_id']);
        if (! Ctx::current()->coversBranch($branch['id'])) {
            return Audit::denied('branch:'.$branch['id']);
        }
        $from = CarbonImmutable::parse($d['date'], $branch['timezone'])->startOfDay()->utc();
        $to = $from->addDay();
        // Lower bound on starts_at: without it MySQL walks every historical row on the chair (starts_at < end-of-day).
        $chairs = Chair::where('branch_id', $branch['id'])->where('active', true)->orderBy('label')
            ->with(['appointments' => fn ($q) => $q->where('starts_at', '>=', $from->subDay())->where('starts_at', '<', $to)->where('ends_at', '>', $from)->orderBy('starts_at')])
            ->get(['tenant_id', 'id', 'branch_id', 'label']);

        $appts = $chairs->flatMap->appointments;
        $patients = collect($this->patients->namesByIds($appts->pluck('patient_id')->unique()->values()->all()))->keyBy('id');
        // Dentists who may be booked in this branch (for the SPA's "Buat Janji" dialog) + names of booked dentists.
        $dentistIds = $this->tenancy->dentistIdsForBranch($branch['id']);
        $names = collect($this->users->namesByIds(array_values(array_unique([...$dentistIds, ...$appts->pluck('dentist_id')]))))->keyBy('id');
        $appts->each(fn ($a) => $a->setRelation('patient', isset($patients[$a->patient_id]) ? new Fluent($patients[$a->patient_id]) : null)
            ->setRelation('dentist', isset($names[$a->dentist_id]) ? new Fluent($names[$a->dentist_id]) : null));
        $dentists = $names->only($dentistIds)->values(); // ordered by name

        return response()->json(['branch' => $branch, 'date' => $d['date'], 'chairs' => $chairs, 'dentists' => $dentists]);
    }

    public function store(StoreAppointmentRequest $request)
    {
        $d = $request->validated();
        $ctx = Ctx::current();
        $starts = CarbonImmutable::parse($d['starts_at'])->utc();
        $ends = CarbonImmutable::parse($d['ends_at'])->utc();
        $this->patients->assertExists($d['patient_id']);

        return DB::transaction(function () use ($d, $ctx, $starts, $ends) {
            $a = $this->book($d['chair_id'], $d['dentist_id'], $starts, $ends);
            if (! $a instanceof Appointment) {
                return $a;
            }
            $a->fill(['patient_id' => $d['patient_id'], 'status' => 'booked', 'reason' => $d['reason'] ?? null, 'created_by' => $ctx->userId])->save();
            Audit::log('buat', 'appointment', $a->id);

            return response()->json(['id' => $a->id, 'status' => $a->status], 201);
        });
    }

    /**
     * Double-booking guard shared by create, reschedule and planned->scheduled (DEVIATIONS #4). Call inside a transaction.
     * No exclusion constraint in MySQL: serialize by locking, always in this order (no deadlock): 1) the chair row,
     * 2) the dentist's membership rows in this tenant. Returns an unsaved Appointment ($existing or new) with slot fields set, or an error response.
     */
    public function book(string $chairId, string $dentistId, CarbonImmutable $starts, CarbonImmutable $ends, ?Appointment $existing = null): Appointment|JsonResponse
    {
        $chair = Chair::lockForUpdate()->findOrFail($chairId);
        if (! Ctx::current()->coversBranch($chair->branch_id)) {
            return Audit::denied('branch:'.$chair->branch_id);
        }
        if (! $this->tenancy->lockActiveDentist($dentistId)) {
            return response()->json(['error' => 'validation', 'message' => 'Dokter gigi tidak ditemukan di klinik ini.'], 422);
        }
        $overlap = fn ($q) => $q->whereIn('status', AppointmentStatus::ACTIVE)->where('starts_at', '<', $ends)->where('ends_at', '>', $starts)
            ->when($existing, fn ($q) => $q->whereKeyNot($existing->id));
        if ($clash = Appointment::where('chair_id', $chair->id)->where($overlap)->value('id')) {
            return response()->json(['error' => 'chair_busy', 'message' => 'Kursi sudah terisi pada jam itu.', 'id' => $clash], 409);
        }
        // Any chair/branch of this tenant (global scope keeps other tenants out).
        if ($clash = Appointment::where('dentist_id', $dentistId)->where($overlap)->value('id')) {
            return response()->json(['error' => 'dentist_busy', 'message' => 'Dokter gigi sudah punya janji pada jam itu.', 'id' => $clash], 409);
        }

        return ($existing ?? new Appointment)->fill(['branch_id' => $chair->branch_id, 'chair_id' => $chair->id, 'dentist_id' => $dentistId,
            'starts_at' => $starts, 'ends_at' => $ends]);
    }

    /** POST /api/appointments/{id}/reschedule {starts_at, ends_at, chair_id?}: only `booked`; same locks + checks as create. */
    public function reschedule(Request $request, string $id)
    {
        $d = $request->validate(['starts_at' => ['required', 'date'], 'ends_at' => ['required', 'date', 'after:starts_at'], 'chair_id' => ['nullable', 'uuid']]);

        return DB::transaction(function () use ($d, $id) {
            $a = Appointment::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($a->branch_id)) {
                return Audit::denied('branch:'.$a->branch_id);
            }
            if ($a->status !== 'booked') {
                return response()->json(['error' => 'not_booked', 'message' => 'Hanya janji berstatus terjadwal yang bisa dipindah.'], 409);
            }
            $from = $a->starts_at->toIso8601ZuluString();
            $r = $this->book($d['chair_id'] ?? $a->chair_id, $a->dentist_id, CarbonImmutable::parse($d['starts_at'])->utc(), CarbonImmutable::parse($d['ends_at'])->utc(), $a);
            if (! $r instanceof Appointment) {
                return $r;
            }
            $r->save();
            Audit::log('jadwal_ulang', 'appointment', $a->id, ['from' => $from, 'to' => $a->starts_at->toIso8601ZuluString()]);

            return response()->json(['id' => $a->id, 'status' => $a->status, 'starts_at' => $a->starts_at, 'ends_at' => $a->ends_at]);
        });
    }

    public function transition(Request $request, string $id)
    {
        $d = $request->validate(['to' => ['required', 'string', 'in:'.implode(',', array_keys(AppointmentStatus::TRANSITIONS))]]);

        return DB::transaction(function () use ($id, $d) {
            $a = Appointment::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($a->branch_id)) {
                return Audit::denied('branch:'.$a->branch_id);
            }
            AppointmentStatus::assertCanMove($a->status, $d['to']);
            $from = $a->status;
            $stamp = AppointmentStatus::STAMPS[$d['to']] ?? null;
            $a->update(['status' => $d['to']] + ($stamp ? [$stamp => now()] : []));
            Audit::log('ubah_status', 'appointment', $a->id, ['from' => $from, 'to' => $d['to']]);

            return response()->json($a->only(['id', 'status', 'arrived_at', 'seated_at', 'dismissed_at', 'wait_minutes', 'chair_minutes']));
        });
    }
}
