<?php

namespace App\Modules\Patients\Domain;

use Carbon\CarbonImmutable;
use DateTimeInterface;

// Care status shown on the patient list (not the administrative patient.status). The ONE place these rules live:
// 1. admin status tidak_aktif / meninggal / diarsip                                       -> tidak_aktif
// 2. open visit (berlangsung) OR appointment today/future (Asia/Jakarta, not cancelled/no_show)
//    OR a final procedure still in course of treatment (Clinical ProcedureStatus::IN_COURSE)  -> dalam_perawatan
// 3. planned appointment perlu_dijadwalkan OR last visit older than 30 days but not older than 12 months -> perlu_kontrol
// 4. anything else (never visited, last visit < 30 days with nothing open, last visit > 12 months) -> tidak_aktif
// Thresholds are proposals (Yohanes to decide). Time-dependent: refresh with `php artisan patients:refresh-care-status`.
final class CareStatus
{
    public const DALAM_PERAWATAN = 'dalam_perawatan';

    public const PERLU_KONTROL = 'perlu_kontrol';

    public const TIDAK_AKTIF = 'tidak_aktif';

    public const ALL = [self::DALAM_PERAWATAN, self::PERLU_KONTROL, self::TIDAK_AKTIF];

    public const CONTROL_AFTER_DAYS = 30;

    public const INACTIVE_AFTER_MONTHS = 12;

    public const INACTIVE_ADMIN_STATUSES = ['tidak_aktif', 'meninggal', 'diarsip'];

    // shortcut: "today" is fixed to Asia/Jakarta (all seeded branches); use the branch timezone once WITA/WIT branches exist.
    public const TIMEZONE = 'Asia/Jakarta';

    public static function of(CareFacts $f, DateTimeInterface $now): string
    {
        $now = CarbonImmutable::instance($now);
        if (in_array($f->adminStatus, self::INACTIVE_ADMIN_STATUSES, true)) {
            return self::TIDAK_AKTIF;
        }
        $today = $now->setTimezone(self::TIMEZONE)->startOfDay();
        if ($f->hasOpenVisit || $f->hasUnfinishedProcedure || ($f->nextAppointmentAt !== null && $f->nextAppointmentAt >= $today)) {
            return self::DALAM_PERAWATAN;
        }
        $last = $f->lastVisitAt;
        if ($f->hasUnscheduledPlan || ($last !== null && $last < $now->subDays(self::CONTROL_AFTER_DAYS)
            && $last >= $now->subMonths(self::INACTIVE_AFTER_MONTHS))) {
            return self::PERLU_KONTROL;
        }

        return self::TIDAK_AKTIF;
    }
}
