<?php

namespace App\Modules\Tenancy\Contracts;

// Public face of Tenancy for other modules (branches + memberships of the CURRENT tenant only).
interface TenancyDirectory
{
    /** @return array{id: string, name: string, timezone: string} 404 when not in this tenant */
    public function branchOrFail(string $branchId): array;

    public function branchExists(string $branchId): bool;

    /** Locks the user's membership rows (FOR UPDATE, fixed order) and says whether one is an active dentist. Call inside a transaction. */
    public function lockActiveDentist(string $userId): bool;

    /** Number of distinct users with an active dentist membership in this tenant (1 = solo practice, D-013). */
    public function activeDentistCount(): int;

    /** @return list<string> distinct user ids with an active membership of $role in this tenant (e.g. owners, unit 4 approvals) */
    public function activeUserIdsWithRole(string $role): array;

    /** Free-edit window for procedure corrections in hours (tenant setting, default 48; DEVIATIONS #53). */
    public function correctionWindowHours(): int;

    /** Selesai needs the dentist's PIN (tenant setting, default false; DEVIATIONS #55). */
    public function selesaiPinRequired(): bool;

    /** @return list<string> user ids of active dentists who may work in this branch */
    public function dentistIdsForBranch(string $branchId): array;
}
