<?php

namespace App\Modules\Agents\Contracts;

// One agent_draft row = one reviewable item (e.g. one ICD suggestion). docs/database.md 4.4: a draft only enters the table
// after format/source checks, so it starts at menunggu_review (= "draf" in the UI). No time-based moves; never final by itself.
enum DraftState: string
{
    case MenungguReview = 'menunggu_review';
    case Disetujui = 'disetujui';
    case Ditolak = 'ditolak';
    case Digantikan = 'digantikan';
    case Kedaluwarsa = 'kedaluwarsa';

    public function canMoveTo(self $to, DraftKind $kind): bool
    {
        if ($this !== self::MenungguReview) {
            return false; // every end state is terminal
        }

        return match ($to) {
            self::Disetujui => $kind->approvable(),
            self::Ditolak, self::Digantikan => true,
            self::Kedaluwarsa => $kind === DraftKind::Ringkasan,
            self::MenungguReview => false,
        };
    }
}
