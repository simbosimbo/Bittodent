<?php

namespace App\Modules\Clinical\Domain;

// Procedure status (Open Dental ProcStatus idea; legend.json "statuses"), on procedure_record only (tooth_finding = visual condition).
// Drafts may take any WRITABLE status. On a final procedure a change = new final row superseding it, only along TRANSITIONS.
// Billing: ONLY `selesai` with a procedure_code raises ProcedureRecorded (one invoice_line). ada_di_klinik_ini = earlier work at this
// clinic (history), ada_di_tempat_lain = done elsewhere, dirujuk = referred, direncanakan = plan, cancelled, superseded: never billed.
final class ProcedureStatus
{
    public const TRANSITIONS = [
        'kondisi_pantau' => ['direncanakan', 'dirujuk'],
        'ada_di_klinik_ini' => ['direncanakan'],   // e.g. an old filling that now needs replacing
        'ada_di_tempat_lain' => ['direncanakan'],
        'direncanakan' => ['selesai', 'dirujuk', 'kondisi_pantau', 'cancelled'],
        'dirujuk' => ['direncanakan'],
        'selesai' => [],                           // final: billed once; replacing done work = POST /procedures/{id}/replace (unit 3)
        'cancelled' => [],                         // plan dropped; never billed
        'superseded' => [],                        // marker row written only by POST /procedures/{id}/replace, never by a status patch
    ];

    public const ALL = ['kondisi_pantau', 'ada_di_klinik_ini', 'ada_di_tempat_lain', 'direncanakan', 'selesai', 'dirujuk', 'cancelled', 'superseded'];

    /** Accepted from clients; `superseded` is not. */
    public const WRITABLE = ['kondisi_pantau', 'ada_di_klinik_ini', 'ada_di_tempat_lain', 'direncanakan', 'selesai', 'dirujuk', 'cancelled'];

    /** Write aliases, stored as the value. `external` = Open Dental EO; needs clinic name + approximate date (unit 2, DEVIATIONS #48). */
    public const ALIASES = ['external' => 'ada_di_tempat_lain'];

    public const EXTERNAL = 'ada_di_tempat_lain';

    public const BILLABLE = 'selesai';

    public const SUPERSEDED = 'superseded';

    /** Existing work a new restoration may replace (unit 3). */
    public const REPLACEABLE = ['selesai', 'ada_di_klinik_ini', 'ada_di_tempat_lain'];

    public static function canMove(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function normalize(?string $s): ?string
    {
        return self::ALIASES[$s] ?? $s;
    }
}
