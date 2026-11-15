<?php

namespace App\Modules\Identity\Contracts;

interface UserDirectory
{
    public const PIN_MAX_FAILURES = 5;

    public const PIN_LOCK_MINUTES = 15;

    /** @param list<string> $ids  @return list<array{id: string, name: string}> ordered by name */
    public function namesByIds(array $ids): array;

    public function hasSelesaiPin(string $userId): bool;

    /**
     * Checks the user's Selesai PIN (DEVIATIONS #54). Counts consecutive failures; the 5th locks for 15 minutes (even a correct PIN
     * is refused while locked). Success resets the counter. Failures and lockouts are audited (`pin_gagal`, `pin_terkunci`, never the
     * PIN). Call inside a transaction that commits on failure too (return a response, do not throw).
     *
     * @return array{result: 'ok'|'no_pin'|'wrong'|'locked'|'lockout', locked_until: ?string} lockout = this attempt caused the lock
     */
    public function verifySelesaiPin(string $userId, ?string $pin, string $via): array;

    /** Set (no PIN yet) or change (current PIN required, checked like verifySelesaiPin). @return array{result: string, locked_until: ?string} */
    public function setSelesaiPin(string $userId, string $pin, ?string $current): array;
}
