<?php

namespace App\Modules\Scheduling\Services;

use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Scheduling\Models\Chair;
use App\Modules\Scheduling\Models\PracticeHour;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use Carbon\CarbonImmutable;

// Free online-booking slots: the dentist's weekly practice hours on that date, cut into service-length steps, minus anything
// overlapping the dentist's active appointments (any channel, any branch) and minus times when no chair of the branch is free.
// Past start times are never returned. No locks: the claim re-checks under locks (PublicBookingController::claim).
class SlotFinder
{
    public const DAYS_AHEAD = 30;

    public const TZ = 'Asia/Jakarta';

    public function __construct(private TenancyDirectory $tenancy) {}

    public static function inWindow(string $date): bool
    {
        $today = CarbonImmutable::now(self::TZ)->format('Y-m-d');

        return $date >= $today && $date <= CarbonImmutable::now(self::TZ)->addDays(self::DAYS_AHEAD)->format('Y-m-d');
    }

    /** @return list<array{starts_at: string, ends_at: string, time: string, branch_id: string}> */
    public function slots(string $dentistId, int $minutes, string $date, ?string $ignoreAppointmentId = null): array
    {
        $day = CarbonImmutable::parse($date, self::TZ);
        $hours = PracticeHour::where('dentist_id', $dentistId)->where('weekday', $day->isoWeekday())->orderBy('start_time')->get();
        if ($hours->isEmpty()) {
            return [];
        }
        $from = $day->startOfDay()->subDay()->utc(); // generous window: branch time zones differ from WIB by at most 2h
        $active = fn ($q) => $q->whereIn('status', AppointmentStatus::ACTIVE)->where('starts_at', '<', $from->addDays(3))->where('ends_at', '>', $from)
            ->when($ignoreAppointmentId, fn ($q) => $q->whereKeyNot($ignoreAppointmentId));
        $mine = Appointment::where('dentist_id', $dentistId)->where($active)->get(['tenant_id', 'id', 'starts_at', 'ends_at']);
        $branchIds = $hours->pluck('branch_id')->unique()->values();
        $chairs = Chair::whereIn('branch_id', $branchIds)->where('active', true)->get(['tenant_id', 'id', 'branch_id'])->groupBy('branch_id');
        $inChairs = Appointment::whereIn('branch_id', $branchIds)->where($active)->get(['tenant_id', 'id', 'chair_id', 'starts_at', 'ends_at'])->groupBy('chair_id');
        $overlaps = fn ($list, $s, $e) => $list->contains(fn ($a) => $a->starts_at < $e && $a->ends_at > $s);
        $now = CarbonImmutable::now();

        $out = [];
        foreach ($hours as $h) {
            $tz = $this->tenancy->branchOrFail($h->branch_id)['timezone'];
            $t = CarbonImmutable::parse("$date {$h->start_time}", $tz);
            $end = CarbonImmutable::parse("$date {$h->end_time}", $tz);
            for (; $t->addMinutes($minutes) <= $end; $t = $t->addMinutes($minutes)) {
                [$s, $e] = [$t->utc(), $t->addMinutes($minutes)->utc()];
                if ($s <= $now || $overlaps($mine, $s, $e)) {
                    continue;
                }
                $chairFree = ($chairs[$h->branch_id] ?? collect())->contains(fn ($c) => ! $overlaps($inChairs[$c->id] ?? collect(), $s, $e));
                if ($chairFree) {
                    $out[] = ['starts_at' => $s->toIso8601ZuluString(), 'ends_at' => $e->toIso8601ZuluString(), 'time' => $t->format('H:i'), 'branch_id' => $h->branch_id];
                }
            }
        }

        return $out;
    }

    /** The slot starting exactly at $startsAt, if it is free (else null). */
    public function find(string $dentistId, int $minutes, CarbonImmutable $startsAt, ?string $ignoreAppointmentId = null): ?array
    {
        $date = $startsAt->setTimezone(self::TZ)->format('Y-m-d');
        if (! self::inWindow($date)) {
            return null;
        }

        return collect($this->slots($dentistId, $minutes, $date, $ignoreAppointmentId))
            ->firstWhere('starts_at', $startsAt->utc()->toIso8601ZuluString());
    }
}
