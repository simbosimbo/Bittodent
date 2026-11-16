<?php

namespace App\Modules\Patients\Http\Controllers;

use App\Modules\Patients\Domain\CareStatus;
use App\Modules\Patients\Http\Requests\StorePatientRequest;
use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Patients\Models\Patient;
use App\Modules\Patients\Services\MrnGenerator;
use App\Modules\Patients\Services\PatientSearch;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $d = $request->validate(['q' => ['nullable', 'string', 'max:100'], 'cursor' => ['nullable', 'string'],
            'care_status' => ['nullable', 'in:'.implode(',', CareStatus::ALL)], 'dentist_id' => ['nullable', 'uuid']]);
        // Keyset pagination on (created_at, id), newest first. Filters hit (tenant_id, care_status|last_dentist_id, created_at, id).
        $page = PatientSearch::query($d['q'] ?? null)
            ->when($d['care_status'] ?? null, fn ($q, $v) => $q->where('care_status', $v))
            ->when($d['dentist_id'] ?? null, fn ($q, $v) => $q->where('last_dentist_id', $v))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->cursorPaginate(25, ['id', 'mrn', 'name', 'dob', 'sex', 'home_branch_id', 'payer_type', 'status', 'created_at',
                'last_visit_at', 'last_dentist_id', 'last_dentist_name', 'care_status']);
        $allergies = self::allergiesFor(collect($page->items())->pluck('id')->all());

        return response()->json([
            'data' => collect($page->items())->map(fn (Patient $p) => [...$p->toArray(), 'allergies' => $allergies[$p->id] ?? []]),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    /**
     * Allergies from the LATEST medical history version of each patient: one query per page (no N+1), decrypted in memory.
     * Same minimum set every patient.read role already sees in /alerts. Health data: never logged.
     *
     * @return array<string, list<string>>
     */
    private static function allergiesFor(array $ids): array
    {
        return MedicalHistoryVersion::whereIn('patient_id', $ids)->orderByDesc('version')->get(['tenant_id', 'patient_id', 'version', 'content_enc'])
            ->unique('patient_id')
            ->mapWithKeys(fn ($v) => [$v->patient_id => array_values(json_decode(Crypto::decrypt($v->content_enc), true)['allergies'] ?? [])])
            ->all();
    }

    public function store(StorePatientRequest $request, TenancyDirectory $tenancy)
    {
        $d = $request->validated();
        $nikBidx = Crypto::blindIndex(Crypto::normalizeNik($d['nik'] ?? null));
        $phoneBidx = Crypto::blindIndex(Crypto::normalizePhone($d['phone'] ?? null));
        if ($dup = $this->duplicate($nikBidx, $phoneBidx)) {
            return $dup;
        }
        $branchId = $d['home_branch_id'] ?? Ctx::current()->branchId;
        if (! $tenancy->branchExists($branchId)) {
            return response()->json(['error' => 'validation', 'message' => 'Cabang tidak ditemukan.'], 422);
        }

        $patient = DB::transaction(function () use ($d, $branchId) {
            $p = (new Patient)->fillIdentity($d)->fill([
                'mrn' => MrnGenerator::next(), // same transaction: rolled back with the patient
                'dob' => $d['dob'] ?? null,
                'sex' => $d['sex'] ?? null,
                'home_branch_id' => $branchId,
                'payer_type' => $d['payer_type'] ?? 'umum',
                'payer_name' => $d['payer_name'] ?? null,
                'payer_member_no' => $d['payer_member_no'] ?? null,
                'payer_class' => $d['payer_class'] ?? null,
                'created_by' => Ctx::current()->userId,
            ]);
            $p->save();
            Audit::log('buat', 'patient', $p->id);

            return $p;
        });

        return response()->json(['id' => $patient->id, 'mrn' => $patient->mrn], 201);
    }

    public function show(string $id)
    {
        $p = Patient::findOrFail($id);
        $nik = Crypto::decrypt($p->nik_enc);
        if ($nik !== null && ! Ctx::current()->can('patient.read_nik')) {
            $nik = str_repeat('*', strlen($nik) - 4).substr($nik, -4);
        }
        Audit::log('baca', 'patient', $p->id);

        return response()->json([
            ...$p->only(['id', 'mrn', 'name', 'sex', 'home_branch_id', 'payer_type', 'payer_name', 'payer_member_no', 'payer_class', 'status',
                'last_dentist_name', 'care_status']),
            'last_visit_at' => $p->last_visit_at?->toIso8601ZuluString(),
            'dob' => $p->dob?->format('Y-m-d'),
            'nik' => $nik,
            'phone' => Crypto::decrypt($p->phone_enc),
            'address' => Crypto::decrypt($p->address_enc),
        ]);
    }

    /** 409 with the existing id only (no other data leaks). */
    private function duplicate(?string $nikBidx, ?string $phoneBidx)
    {
        foreach (['nik_bidx' => $nikBidx, 'phone_bidx' => $phoneBidx] as $col => $val) {
            if ($val !== null && ($id = Patient::where($col, $val)->value('id'))) {
                return response()->json(['error' => 'duplicate', 'field' => substr($col, 0, -5), 'id' => $id], 409);
            }
        }

        return null;
    }
}
