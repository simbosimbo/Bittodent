<?php

namespace App\Modules\TreatmentSuggestions\Http\Controllers;

use App\Modules\TreatmentSuggestions\Domain\SuggestionRefused;
use App\Modules\TreatmentSuggestions\Services\SuggestionService;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// A2 endpoints (perm ai_draft.review = dentist). Responses carry codes and procedure names only, never prices.
class SuggestionController extends Controller
{
    public function __construct(private SuggestionService $svc) {}

    public function forVisit(string $id): JsonResponse
    {
        return $this->run(fn () => $this->svc->forVisit($id));
    }

    public function forPatient(string $id): JsonResponse
    {
        return $this->run(fn () => $this->svc->forPatient($id));
    }

    public function approve(string $id): JsonResponse
    {
        return $this->run(fn () => $this->svc->approve($id));
    }

    public function approveAll(string $id): JsonResponse
    {
        return $this->run(fn () => $this->svc->approveAll($id));
    }

    public function reject(string $id, Request $request): JsonResponse
    {
        $d = $request->validate(['reason' => ['sometimes', 'string', 'in:'.implode(',', array_keys(SuggestionService::REJECT_REASONS))]]);

        return $this->run(function () use ($id, $d) {
            $this->svc->reject($id, $d['reason'] ?? 'tidak_perlu'); // one tap = "tidak perlu"; the reason is feedback, not a record

            return ['id' => $id, 'state' => 'ditolak'];
        });
    }

    private function run(callable $fn): JsonResponse
    {
        try {
            return response()->json($fn());
        } catch (SuggestionRefused $e) {
            if (in_array($e->reason, ['forbidden', 'branch'], true)) {
                Audit::log('akses_ditolak', 'saran_tindakan', null, ['why' => $e->reason]);
            }

            return response()->json(['error' => $e->reason, 'message' => SuggestionRefused::MESSAGE[$e->reason] ?? $e->reason], SuggestionRefused::STATUS[$e->reason] ?? 409);
        }
    }
}
