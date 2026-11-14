<?php

namespace App\Modules\Scheduling\Domain;

use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

// Appointment state machine. Only listed transitions are legal; anything else is a 409.
final class AppointmentStatus
{
    public const TRANSITIONS = [
        'booked' => ['checked_in', 'cancelled', 'no_show'],
        'checked_in' => ['in_treatment'],
        'in_treatment' => ['done'],
        'done' => [], 'cancelled' => [], 'no_show' => [],
    ];

    /** Timestamp set when entering a state (Open Dental DateTimeArrived/Seated/Dismissed). */
    public const STAMPS = ['checked_in' => 'arrived_at', 'in_treatment' => 'seated_at', 'done' => 'dismissed_at'];

    /** States that occupy the chair (count for double-booking). */
    public const ACTIVE = ['booked', 'checked_in', 'in_treatment'];

    public static function canMove(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function assertCanMove(string $from, string $to): void
    {
        if (! self::canMove($from, $to)) {
            throw new ConflictHttpException("Status janji tidak bisa berpindah dari $from ke $to.");
        }
    }
}
