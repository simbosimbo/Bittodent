<?php

namespace App\Modules\Scribe\Http\Controllers;

use App\Modules\Agents\Contracts\DraftReviewDenied;
use App\Modules\Scribe\Contracts\ScribeDenied;
use App\Modules\Scribe\Contracts\ScribeEngine;
use App\Modules\Scribe\Models\ScribeSession;
use App\Shared\Http\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ScribeController extends Controller
{
    public function show(string $id, ScribeEngine $engine): JsonResponse
    {
        return response()->json($engine->statusForVisit($id));
    }

    public function store(string $id, Request $request, ScribeEngine $engine): JsonResponse
    {
        $this->assertTreatingDentist($request, $id);
        $file = $request->file('audio');
        if ($file === null || ! $file->isValid()) {
            throw ValidationException::withMessages(['audio' => 'Berkas audio wajib.']);
        }
        $maxBytes = (int) config('ai.scribe.max_bytes', 25 * 1024 * 1024);
        $maxDur = (int) config('ai.scribe.max_duration_sec', 900);
        $duration = (int) $request->input('duration_sec', 0);
        if ($file->getSize() > $maxBytes || $duration < 1 || $duration > $maxDur) {
            throw new ScribeDenied(ScribeDenied::INVALID_AUDIO, 422);
        }
        $mime = $file->getMimeType() ?: (string) $file->getClientMimeType();
        $allowed = config('ai.scribe.audio_mimes');
        if (! in_array($mime, $allowed, true) && ! str_starts_with((string) $mime, 'audio/')) {
            throw new ScribeDenied(ScribeDenied::INVALID_AUDIO, 422);
        }
        try {
            $sessionId = $engine->ingest($id, $request->user()->id, file_get_contents($file->getRealPath()), $mime, $duration);
        } catch (ScribeDenied $e) {
            return self::denied($e);
        }

        return response()->json($engine->statusForVisit($id) + ['id' => $sessionId], 201);
    }

    public function process(string $id, Request $request, ScribeEngine $engine): JsonResponse
    {
        $session = ScribeSession::findOrFail($id);
        $this->assertTreatingDentist($request, $session->visit_id);
        try {
            $engine->process($id);
        } catch (ScribeDenied $e) {
            return self::denied($e);
        }

        return response()->json($engine->statusForVisit($session->visit_id));
    }

    public function approve(string $id, Request $request, ScribeEngine $engine): JsonResponse
    {
        $data = $request->validate(['text' => ['nullable', 'string', 'max:4000']]);
        try {
            $item = $engine->approveItem($id, $data['text'] ?? null);
        } catch (DraftReviewDenied $e) {
            return self::reviewDenied($e);
        }

        return response()->json(['state' => 'disetujui'] + $item);
    }

    public function reject(string $id, Request $request, ScribeEngine $engine): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        try {
            $engine->rejectItem($id, $data['reason']);
        } catch (DraftReviewDenied $e) {
            return self::reviewDenied($e);
        }

        return response()->json(['id' => $id, 'state' => 'ditolak']);
    }

    private function assertTreatingDentist(Request $request, string $visitId): void
    {
        $visit = app(\App\Modules\Clinical\Contracts\VisitDirectory::class)->findOrFail($visitId);
        if ($visit['dentist_id'] !== $request->user()->id) {
            throw new ScribeDenied(ScribeDenied::FORBIDDEN, 403);
        }
    }

    private static function denied(ScribeDenied $e): JsonResponse
    {
        $messages = [
            ScribeDenied::PAID_DISABLED => 'Scribe berbayar nonaktif.',
            ScribeDenied::TOKEN_CAP => 'Batas token bulanan tercapai.',
            ScribeDenied::INVALID_AUDIO => 'Berkas atau durasi audio tidak valid.',
            ScribeDenied::STT_UNAVAILABLE => 'Transkripsi in-region belum tersedia.',
            ScribeDenied::PROCESSING_FAILED => 'Draf SOAP tidak lolos validasi sitasi.',
            ScribeDenied::FORBIDDEN => 'Anda tidak punya izin untuk tindakan ini.',
        ];

        return response()->json(['error' => $e->reason, 'message' => $messages[$e->reason] ?? 'Ditolak.'], $e->status);
    }

    private static function reviewDenied(DraftReviewDenied $e): JsonResponse
    {
        return match ($e->reason) {
            DraftReviewDenied::FORBIDDEN => response()->json(['error' => 'forbidden', 'message' => 'Anda tidak punya izin untuk tindakan ini.'], 403),
            default => response()->json(['error' => 'wrong_state', 'message' => 'Draf ini sudah ditinjau.'], 409),
        };
    }
}
