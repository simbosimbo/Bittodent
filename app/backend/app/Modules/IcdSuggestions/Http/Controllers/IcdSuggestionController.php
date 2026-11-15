<?php

namespace App\Modules\IcdSuggestions\Http\Controllers;

use App\Modules\IcdSuggestions\Domain\IcdRefused;
use App\Modules\IcdSuggestions\Services\IcdSuggestionService;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// A1 endpoints (perm ai_draft.review = dentist). Responses carry codes, official displays and refs only.
class IcdSuggestionController extends Controller
{
    public function __construct(private IcdSuggestionService $svc) {}

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
        $d = $request->validate(['reason' => ['sometimes', 'string', 'in:'.implode(',', array_keys(IcdSuggestionService::REJECT_REASONS))]]);

        return $this->run(function () use ($id, $d) {
            $this->svc->reject($id, $d['reason'] ?? 'tidak_sesuai'); // one tap = "tidak sesuai"; the reason is feedback, not a record

            return ['id' => $id, 'state' => 'ditolak'];
        });
    }

    private function run(callable $fn): JsonResponse
    {
        try {
            return response()->json($fn());
        } catch (IcdRefused $e) {
            if (in_array($e->reason, ['forbidden', 'branch'], true)) {
                Audit::log('akses_ditolak', 'saran_icd', null, ['why' => $e->reason]);
            }

            return response()->json(['error' => $e->reason, 'message' => IcdRefused::MESSAGE[$e->reason] ?? $e->reason], IcdRefused::STATUS[$e->reason] ?? 409);
        }
    }
}
