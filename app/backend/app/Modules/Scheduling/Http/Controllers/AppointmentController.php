<?php

namespace App\Modules\Scheduling\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Scheduling\Contracts\WalkInVisits;
use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Modules\Scheduling\Events\AppointmentCompleting;
use App\Modules\Scheduling\Http\Requests\StoreAppointmentRequest;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Services\PatientCareSync;
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
    public function __construct(private TenancyDirectory $tenancy, private PatientDirectory $patients, private UserDirectory $users, private PatientCareSync $care) {}

    /** Chairs of one branch with that local day's appointments; patient/dentist names via other modules' Contracts (constant query count). */
    public function schedule(Request $request, WalkInVisits $walkIns)
    {
        $d = $request->validate(['branch_id' => ['required', 'uuid'], 'date' => ['required', 'date_format:Y-m-d']]);
        $branch = $this->tenancy->branchOrFail($d['branch_id']);
        if (! Ctx::current()->coversBranch($branch['id'])) {
            return Audit::denied('branch:'.$branch['id']);
        }
        $from = CarbonImmutable::parse($d['date'], $branch['timezone'])->startOfDay()->utc();
        $chairs = Chair::where('branch_id', $branch['id'])->where('active', true)->orderBy('label')
            ->with(['appointments' => fn ($q) => $q->where('starts_at', '<', $from->addDay())->where('ends_at', '>', $from)->orderBy('starts_at')])
            ->get(['tenant_id', 'id', 'branch_id', 'label']);

        $appts = $chairs->flatMap->appointments;
        $patients = collect($this->patients->namesByIds($appts->pluck('patient_id')->unique()->values()->all()))->keyBy('id');
        // Dentists who may be booked in this branch (for the SPA's "Buat Janji" dialog) + names of booked dentists.
        $dentistIds = $this->tenancy->dentistIdsForBranch($branch['id']);
        $names = collect($this->users->namesByIds(array_values(array_unique([...$dentistIds, ...$appts->pluck('dentist_id')]))))->keyBy('id');
        $appts->each(fn ($a) => $a->setRelation('patient', isset($patients[$a->patient_id]) ? new Fluent($patients[$a->patient_id]) : null)
            ->setRelation('dentist', isset($names[$a->dentist_id]) ? new Fluent($names[$a->dentist_id]) : null));
        $dentists = $names->only($dentistIds)->values(); // ordered by name
        // Jadwal "Bayar" opens #/tagihan/<visit_id>: only for users who may read invoices (one query, no clinical content).
        if (Ctx::current()->can('billing.read')) {
            $visits = $walkIns->visitIdsByAppointment($appts->pluck('id')->all());
            $appts->each(fn ($a) => $a->setAttribute('visit_id', $visits[$a->id] ?? null));
        }

        // Beranda KPI: walk-in patients (visit without appointment) who have no active appointment that day. Count only, no ids/names.
        $booked = $appts->whereNotIn('status', ['cancelled', 'no_show', 'rejected'])->pluck('patient_id')->all();
        $walkIn = count(array_diff($walkIns->patientIds($branch['id'], $from, $from->addDay()), $booked));

        return response()->json(['branch' => $branch, 'date' => $d['date'], 'chairs' => $chairs, 'dentists' => $dentists, 'walk_in_patients' => $walkIn]);
    }

    /** GET /api/dentists: active dentists of this tenant [{id, name}] ordered by name (patient list "Dokter" filter). */
    public function dentists()
    {
        return response()->json(['data' => $this->users->namesByIds($this->tenancy->activeUserIdsWithRole('dentist'))]);
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
            $this->care->push($a->patient_id);

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

    /**
     * POST /api/appointments/{id}/reschedule {starts_at, ends_at, chair_id?}: only `booked`; same locks + checks as create.
     * The dentist never changes here: a different dentist_id is rejected (422 dentist_locked); the only path is POST .../refer (DEVIATIONS #68).
     */
    public function reschedule(Request $request, string $id)
    {
        $d = $request->validate(['starts_at' => ['required', 'date'], 'ends_at' => ['required', 'date', 'after:starts_at'], 'chair_id' => ['nullable', 'uuid'],
            'dentist_id' => ['nullable', 'uuid']]);

        return DB::transaction(function () use ($d, $id) {
            $a = Appointment::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($a->branch_id)) {
                return Audit::denied('branch:'.$a->branch_id);
            }
            if (isset($d['dentist_id']) && $d['dentist_id'] !== $a->dentist_id) {
                return self::dentistLocked();
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
            $this->care->push($a->patient_id);

            return response()->json(['id' => $a->id, 'status' => $a->status, 'starts_at' => $a->starts_at, 'ends_at' => $a->ends_at]);
        });
    }

    private static function dentistLocked(): JsonResponse
    {
        return response()->json(['error' => 'dentist_locked', 'message' => 'Dokter gigi janji tidak bisa diubah di sini. Gunakan Rujuk.'], 422);
    }

    /**
     * POST /api/appointments/{id}/chair {chair_id}: "Ganti kursi" for an active appointment (same time, same dentist, same branch).
     * The chair is operational, not clinical: anyone who moves appointments may change it; the chair double-booking check still applies.
     */
    public function changeChair(Request $request, string $id)
    {
        $d = $request->validate(['chair_id' => ['required', 'uuid'], 'dentist_id' => ['nullable', 'uuid']]);

        return DB::transaction(function () use ($d, $id) {
            $a = Appointment::lockForUpdate()->findOrFail($id);
            if (! Ctx::current()->coversBranch($a->branch_id)) {
                return Audit::denied('branch:'.$a->branch_id);
            }
            if (isset($d['dentist_id']) && $d['dentist_id'] !== $a->dentist_id) {
                return self::dentistLocked();
            }
            if (! in_array($a->status, AppointmentStatus::ACTIVE, true)) {
                return response()->json(['error' => 'not_active', 'message' => 'Kursi hanya bisa diganti untuk janji yang masih berjalan.'], 409);
            }
            $chair = Chair::find($d['chair_id']);
            if (! $chair || $chair->branch_id !== $a->branch_id || ! $chair->active) {
                return response()->json(['error' => 'validation', 'message' => 'Kursi tidak ada di cabang ini.'], 422);
            }
            if ($chair->id === $a->chair_id) {
                return response()->json(['id' => $a->id, 'chair_id' => $a->chair_id]);
            }
            $from = $a->chair_id;
            $r = $this->book($chair->id, $a->dentist_id, CarbonImmutable::parse($a->starts_at), CarbonImmutable::parse($a->ends_at), $a);
            if (! $r instanceof Appointment) {
                return $r;
            }
            $r->save();
            Audit::log('ganti_kursi', 'appointment', $a->id, ['from' => $from, 'to' => $a->chair_id]);

            return response()->json(['id' => $a->id, 'chair_id' => $a->chair_id]);
        });
    }

    /**
     * POST /api/appointments/{id}/refer {dentist_id, reason}: "Rujuk" = the only way to move an appointment to another dentist
     * (DEVIATIONS #68). Reason required; owner/front desk/kasir any appointment, a dentist only their own; before treatment starts only
     * (pending_confirmation, booked, checked_in). Same chair/time; the new dentist's double-booking check applies. Audited with the reason.
     */
    public function refer(Request $request, string $id)
    {
        $d = $request->validate(['dentist_id' => ['required', 'uuid'], 'reason' => ['required', 'string', 'min:5', 'max:500']]);

        return DB::transaction(function () use ($d, $id) {
            $a = Appointment::lockForUpdate()->findOrFail($id);
            $ctx = Ctx::current();
            if (! $ctx->coversBranch($a->branch_id)) {
                return Audit::denied('branch:'.$a->branch_id);
            }
            // owner and front desk (front_desk, kasir): any appointment, e.g. "Dokter berhalangan"; a dentist only their own patients.
            if (! array_intersect(['owner', 'front_desk', 'kasir'], $ctx->roles) && $a->dentist_id !== $ctx->userId) {
                return Audit::denied('appointment.refer');
            }
            if (! in_array($a->status, ['pending_confirmation', 'booked', 'checked_in'], true)) {
                return response()->json(['error' => 'not_referable', 'message' => 'Hanya janji yang belum mulai perawatan yang bisa dirujuk.'], 409);
            }
            if ($d['dentist_id'] === $a->dentist_id) {
                return response()->json(['error' => 'validation', 'message' => 'Pilih dokter gigi lain.', 'errors' => ['dentist_id' => ['Pilih dokter gigi lain.']]], 422);
            }
            if (! in_array($d['dentist_id'], $this->tenancy->dentistIdsForBranch($a->branch_id), true)) {
                return response()->json(['error' => 'validation', 'message' => 'Dokter gigi tidak praktik di cabang ini.', 'errors' => ['dentist_id' => ['Dokter gigi tidak praktik di cabang ini.']]], 422);
            }
            $from = $a->dentist_id;
            $r = $this->book($a->chair_id, $d['dentist_id'], CarbonImmutable::parse($a->starts_at), CarbonImmutable::parse($a->ends_at), $a);
            if (! $r instanceof Appointment) {
                return $r;
            }
            $r->save();
            Audit::log('rujuk', 'appointment', $a->id, ['from_dentist' => $from, 'to_dentist' => $a->dentist_id, 'reason' => trim($d['reason'])]);
            $this->care->push($a->patient_id);

            return response()->json(['id' => $a->id, 'dentist_id' => $a->dentist_id, 'status' => $a->status]);
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
            if ($d['to'] === 'done') { // unit 4: closes the linked visit; blocked (invoice_required) => nothing changes
                event(new AppointmentCompleting(Ctx::current()->tenant(), $a->id));
            }
            $from = $a->status;
            if (in_array('pending_confirmation', [$from, $d['to']], true) && ! Ctx::current()->can('appointment.confirm')) {
                return Audit::denied('appointment.confirm'); // confirm/reject an online booking
            }
            $stamp = AppointmentStatus::STAMPS[$d['to']] ?? null;
            $a->update(['status' => $d['to']] + ($stamp ? [$stamp => now()] : []));
            Audit::log('ubah_status', 'appointment', $a->id, ['from' => $from, 'to' => $d['to']]);
            $this->care->push($a->patient_id);

            return response()->json($a->only(['id', 'status', 'arrived_at', 'seated_at', 'dismissed_at', 'wait_minutes', 'chair_minutes']));
        });
    }
}
