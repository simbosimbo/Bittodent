<?php

namespace App\Modules\TreatmentSuggestions\Domain;

use RuntimeException;

final class SuggestionRefused extends RuntimeException
{
    public const STATUS = ['not_found' => 404, 'forbidden' => 403, 'branch' => 403, 'visit_closed' => 409, 'stale' => 409,
        'draft_exists' => 409, 'wrong_state' => 409, 'invalid' => 422];

    public const MESSAGE = [
        'not_found' => 'Saran atau kunjungan tidak ditemukan.',
        'forbidden' => 'Anda tidak punya izin untuk tindakan ini.',
        'branch' => 'Kunjungan ini di cabang yang bukan wewenang Anda.',
        'visit_closed' => 'Kunjungan sudah ditandatangani; rencana baru lewat kunjungan berikutnya.',
        'stale' => 'Temuan sumber sudah berubah atau tindakan sudah direncanakan. Muat ulang saran.',
        'draft_exists' => 'Sudah ada draf lain di gigi/permukaan ini pada kunjungan ini.',
        'wrong_state' => 'Saran ini sudah ditinjau.',
        'invalid' => 'Saran tidak valid untuk odontogram.',
    ];

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
