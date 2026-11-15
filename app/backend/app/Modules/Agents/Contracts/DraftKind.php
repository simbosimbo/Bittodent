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
    case SaranTindakan = 'saran_tindakan'; // A2: rule-based treatment suggestion from the odontogram, one item per draft

    public function approvable(): bool
    {
        return $this !== self::Ringkasan;
    }

    /**
     * Kinds whose approval must also run the owning feature's side effect (e.g. saran_tindakan creates a draft plan item).
     * They are reviewed only through that feature's endpoint, never through the generic /api/ai-drafts routes.
     */
    public function ownFlow(): bool
    {
        return $this === self::SaranTindakan;
    }
}
