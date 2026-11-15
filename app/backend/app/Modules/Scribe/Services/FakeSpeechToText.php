<?php

namespace App\Modules\Scribe\Services;

use App\Modules\Scribe\Contracts\SpeechToText;
use App\Modules\Scribe\Contracts\Transcript;
use App\Modules\Scribe\Contracts\TranscriptSegment;

// Deterministic synthetic Indonesian dental dictation. No network, no audio parsing, no logging of text.
final class FakeSpeechToText implements SpeechToText
{
    public int $calls = 0;

    public function transcribe(string $absolutePath, string $mime, int $durationSec): Transcript
    {
        $this->calls++;

        return new Transcript([
            new TranscriptSegment('T1', 'Pasien mengeluh nyeri berdenyut pada gigi 46 sejak tiga hari.'),
            new TranscriptSegment('T2', 'Tes perkusi positif, tidak ada pembengkakan.'),
            new TranscriptSegment('T3', 'Penilaian pulpa iritasinya akut pada 46.'),
            new TranscriptSegment('T4', 'Rencana perawatan saluran akar 46, kontrol satu minggu.'),
        ]);
    }
}
