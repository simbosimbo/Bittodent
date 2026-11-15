<?php

namespace App\Modules\Scribe\Contracts;

enum ScribeSessionState: string
{
    case Terunggah = 'terunggah';
    case Memproses = 'memproses';
    case DrafSiap = 'draf_siap';
    case Gagal = 'gagal';
    case AudioDihapus = 'audio_dihapus';
}
