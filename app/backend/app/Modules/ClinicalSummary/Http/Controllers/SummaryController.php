<?php

namespace App\Modules\ClinicalSummary\Http\Controllers;

use App\Modules\Clinical\Contracts\ClinicalHistory;
use App\Modules\ClinicalSummary\Http\Requests\GenerateSummaryRequest;
use App\Modules\ClinicalSummary\Services\SummaryService;
use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Design 2.7 + 5.1. Route guard perm:summary.generate (dentist only). Here: licensed dentist + treating this patient.
class SummaryController extends Controller
{
    public const TREATING_MONTHS = 12;

    public function __construct(private SummaryService $summaries, private PatientDirectory $patients, private UserDirectory $users, private ClinicalHistory $clinical) {}

    public function store(GenerateSummaryRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->guard($id)) {
            return $denied;
        }
        $out = $this->summaries->generate($id, $request->scope(), $request->boolean('allow_llm', true));

        return response()->json($out['body'], $out['status_code']);
    }

    public function show(string $id): JsonResponse
    {
        if ($denied = $this->guard($id)) {
            return $denied;
        }
        $summary = $this->summaries->latest($id);

        return $summary === null
            ? response()->json(['error' => 'no_summary', 'message' => 'Belum ada ringkasan yang berlaku. Buat ringkasan baru.'], 404)
            : response()->json($summary);
    }

    private function guard(string $patientId): ?JsonResponse
    {
        $this->patients->assertExists($patientId); // 404 for another tenant
        $me = Ctx::current()->userId;
        if ($this->users->licenseType($me) !== 'dokter_gigi') {
            Audit::log('akses_ditolak', 'patient', $patientId, ['permission' => 'summary.generate', 'reason' => 'license_required']);

            return response()->json(['error' => 'license_required', 'message' => 'Hanya dokter gigi berizin yang boleh membuat ringkasan.'], 403);
        }
        if (! $this->clinical->treatedWithin($patientId, $me, self::TREATING_MONTHS)) {
            Audit::log('akses_ditolak', 'patient', $patientId, ['permission' => 'summary.generate', 'reason' => 'not_treating']);

            return response()->json(['error' => 'not_treating', 'message' => 'Ringkasan hanya untuk dokter yang merawat pasien ini.'], 403);
        }

        return null;
    }
}
