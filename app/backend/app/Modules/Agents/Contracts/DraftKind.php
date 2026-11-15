<?php

namespace App\Modules\Agents\Contracts;

// agent_draft.kind (docs/database.md 3.9) + `ringkasan`, which is a reading aid only and can never be approved
// into the medical record (PR #1 design 2.8).
enum DraftKind: string
{
    case Soap = 'soap';
    case Odontogram = 'odontogram';
    case KodeIcd = 'kode_icd';
    case Resep = 'resep';
    case Pendaftaran = 'pendaftaran';
    case Ringkasan = 'ringkasan';

    public function approvable(): bool
    {
        return $this !== self::Ringkasan;
    }
}
