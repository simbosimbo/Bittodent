<?php

namespace App\Modules\Tenancy\Services;

use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;

final class TenancyDirectoryService implements TenancyDirectory
{
    public function branchOrFail(string $branchId): array
    {
        return Branch::findOrFail($branchId)->only(['id', 'name', 'timezone']);
    }

    public function branchExists(string $branchId): bool
    {
        return Branch::whereKey($branchId)->exists();
    }

    public function lockActiveDentist(string $userId): bool
    {
        return Membership::where('user_id', $userId)->orderBy('id')->lockForUpdate()->get()
            ->contains(fn ($m) => $m->role === 'dentist' && $m->revoked_at === null);
    }

    public function activeDentistCount(): int
    {
        return Membership::where('role', 'dentist')->whereNull('revoked_at')->distinct()->count('user_id');
    }

    public function activeUserIdsWithRole(string $role): array
    {
        return Membership::where('role', $role)->whereNull('revoked_at')->distinct()->pluck('user_id')->all();
    }

    public function correctionWindowHours(): int
    {
        return (int) Tenant::findOrFail(Ctx::current()->tenant())->correction_window_hours;
    }

    public function selesaiPinRequired(): bool
    {
        return (bool) Tenant::findOrFail(Ctx::current()->tenant())->selesai_pin_required;
    }

    public function dentistIdsForBranch(string $branchId): array
    {
        return Membership::where('role', 'dentist')->whereNull('revoked_at')
            ->where(fn ($q) => $q->whereNull('branch_id')->orWhere('branch_id', $branchId))->pluck('user_id')->all();
    }
}
