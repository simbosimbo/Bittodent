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

    /** @return list<string> user ids of active dentists who may work in this branch */
    public function dentistIdsForBranch(string $branchId): array;
}
