<?php

namespace App\Shared\Tenancy;

use App\Shared\Permissions\Permissions;
use Illuminate\Support\Collection;
use RuntimeException;

// Request-scoped tenant context (container `scoped` binding: reset per request/job; under Octane never make it static).
// Filled only by TenantContext middleware (from the user's own memberships + session) or Ctx::runAs (seed/jobs/tests).
final class Ctx
{
    public ?string $tenantId = null;

    public ?string $branchId = null;

    public ?string $userId = null;

    /** audit_event.actor_type: user (staff login) | publik (patient on the public booking page, no login) */
    public string $actorType = 'user';

    /** @var list<string> roles valid for the active branch */
    public array $roles = [];

    /** @var list<string>|null branches the user may work in (null = all branches of the tenant) */
    public ?array $branchIds = null;

    public ?Collection $memberships = null;

    public static function current(): self
    {
        return app(self::class);
    }

    public function tenant(): string
    {
        return $this->tenantId ?? throw new RuntimeException('Konteks tenant belum di-set; query tenant ditolak.');
    }

    /** Run $fn with a tenant context (seeders, queued jobs, tests), then restore the previous one. */
    public static function runAs(string $tenantId, callable $fn, ?string $userId = null): mixed
    {
        $ctx = self::current();
        $prev = [$ctx->tenantId, $ctx->userId];
        [$ctx->tenantId, $ctx->userId] = [$tenantId, $userId ?? $ctx->userId];
        try {
            return $fn();
        } finally {
            [$ctx->tenantId, $ctx->userId] = $prev;
        }
    }

    public function can(string $permission): bool
    {
        return Permissions::allows($this->roles, $permission);
    }

    public function coversBranch(string $branchId): bool
    {
        return $this->branchIds === null || in_array($branchId, $this->branchIds, true);
    }
}
