<?php

namespace App\Modules\Clinical\Domain;

// Procedure status of an odontogram item, separate from its condition (Open Dental ProcStatus idea; legend.json "statuses").
// Drafts may take any status. On a signed (final) item a change = new final row superseding it, only along TRANSITIONS.
final class ProcedureStatus
{
    public const TRANSITIONS = [
        'kondisi_pantau' => ['direncanakan', 'dirujuk'],
        'ada_di_klinik_ini' => ['direncanakan'],   // e.g. an old filling that now needs replacing
        'ada_di_tempat_lain' => ['direncanakan'],
        'direncanakan' => ['selesai', 'dirujuk', 'kondisi_pantau'],
        'dirujuk' => ['direncanakan'],
        'selesai' => [],                           // final: billed once, never changes
    ];

    public const ALL = ['kondisi_pantau', 'ada_di_klinik_ini', 'ada_di_tempat_lain', 'direncanakan', 'selesai', 'dirujuk'];

    /** Still in course of treatment (patient list: "Dalam perawatan"). dirujuk = treated elsewhere, not counted. */
    public const IN_COURSE = ['direncanakan'];

    public static function canMove(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }
}
