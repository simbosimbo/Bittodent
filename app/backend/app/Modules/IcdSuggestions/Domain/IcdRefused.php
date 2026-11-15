<?php

namespace App\Modules\IcdSuggestions\Domain;

use RuntimeException;

final class IcdRefused extends RuntimeException
{
    public const STATUS = ['not_found' => 404, 'forbidden' => 403, 'branch' => 403, 'visit_closed' => 409, 'stale' => 409,
        'wrong_state' => 409, 'bad_code' => 422, 'too_many' => 409];

    public const MESSAGE = [
        'not_found' => 'Saran atau kunjungan tidak ditemukan.',
        'forbidden' => 'Anda tidak punya izin untuk tindakan ini.',
        'branch' => 'Kunjungan ini di cabang yang bukan wewenang Anda.',
        'visit_closed' => 'Kunjungan sudah ditandatangani; kode baru lewat koreksi.',
        'stale' => 'Kode ini tidak ada lagi di kamus. Muat ulang saran.',
        'wrong_state' => 'Saran ini sudah ditinjau.',
        'bad_code' => 'Format kode tidak valid.',
        'too_many' => 'Catatan sudah berisi 10 kode.',
    ];

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
