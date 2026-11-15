<?php

namespace App\Modules\Scribe\Contracts;

use Illuminate\Http\JsonResponse;
use RuntimeException;

// Reason codes only — never paths, transcripts, or clinical text.
final class ScribeDenied extends RuntimeException
{
    public const FORBIDDEN = 'forbidden';

    public const PAID_DISABLED = 'paid_disabled';

    public const TOKEN_CAP = 'token_cap';

    public const INVALID_AUDIO = 'invalid_audio';

    public const STT_UNAVAILABLE = 'stt_unavailable';

    public const PROCESSING_FAILED = 'processing_failed';

    public function __construct(public string $reason, public int $status = 403)
    {
        parent::__construct($reason);
    }

    public function render(): JsonResponse
    {
        $messages = [
            self::PAID_DISABLED => 'Scribe berbayar nonaktif.',
            self::TOKEN_CAP => 'Batas token bulanan tercapai.',
            self::INVALID_AUDIO => 'Berkas atau durasi audio tidak valid.',
            self::STT_UNAVAILABLE => 'Transkripsi in-region belum tersedia.',
            self::PROCESSING_FAILED => 'Draf SOAP tidak lolos validasi sitasi.',
            self::FORBIDDEN => 'Anda tidak punya izin untuk tindakan ini.',
        ];

        return response()->json(['error' => $this->reason, 'message' => $messages[$this->reason] ?? 'Ditolak.'], $this->status);
    }
}
