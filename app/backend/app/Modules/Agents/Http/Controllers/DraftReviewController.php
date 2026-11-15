<?php

namespace App\Modules\Agents\Http\Controllers;

use App\Modules\Agents\Contracts\AgentDrafts;
use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Shared\Http\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Approve/reject one agent draft item. Approval returns the payload for the owning module's own draft+sign flow;
// it does not create or change any clinical record.
class DraftReviewController extends Controller
{
    public function approve(string $id, AgentDrafts $drafts): JsonResponse
    {
        try {
            $payload = $drafts->approve($id);
        } catch (DraftReviewDenied $e) {
            return self::denied($e);
        }

        return response()->json(['id' => $id, 'state' => 'disetujui', 'payload' => $payload]);
    }

    public function reject(string $id, Request $request, AgentDrafts $drafts): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        try {
            $drafts->reject($id, $data['reason']);
        } catch (DraftReviewDenied $e) {
            return self::denied($e);
        }

        return response()->json(['id' => $id, 'state' => 'ditolak']);
    }

    private static function denied(DraftReviewDenied $e): JsonResponse
    {
        return match ($e->reason) {
            DraftReviewDenied::FORBIDDEN => response()->json(['error' => 'forbidden', 'message' => 'Anda tidak punya izin untuk tindakan ini.'], 403),
            DraftReviewDenied::OWN_FLOW, DraftReviewDenied::WRONG_KIND => response()->json(['error' => $e->reason, 'message' => 'Draf ini ditinjau lewat fiturnya sendiri.'], 409),
            DraftReviewDenied::NOT_APPROVABLE => response()->json(['error' => 'not_approvable', 'message' => 'Ringkasan AI hanya alat baca dan tidak bisa disetujui menjadi rekam medis.'], 422),
            default => response()->json(['error' => 'wrong_state', 'message' => 'Draf ini sudah ditinjau.'], 409),
        };
    }
}
