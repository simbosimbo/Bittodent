<?php

namespace App\Shared\Platform;

// Request-scoped impersonation state (DEVIATIONS #61), container `scoped` like Ctx. Filled ONLY by Platform's LoadImpersonation
// middleware after it checked the server-side platform_impersonation row; empty = not impersonating.
final class Impersonation
{
    /** Actions a platform admin may never do on behalf of the clinic user (403 via `not_impersonating`; /api/me flag list). */
    public const BLOCKED_ACTIONS = ['selesai', 'approve_drafts', 'addendum', 'procedure_sign', 'procedure_correction',
        'correction_decision', 'password', 'mfa', 'pin', 'platform_admin'];

    public ?string $id = null;

    public ?string $platformAdminId = null;

    public ?string $platformAdminName = null;

    public ?string $tenantId = null;

    public ?string $userId = null;

    public ?string $startedAt = null;

    public ?string $requestId = null;

    public static function current(): self
    {
        return app(self::class);
    }

    public function active(): bool
    {
        return $this->id !== null;
    }

    public function set(string $id, string $adminId, string $adminName, string $tenantId, string $userId, string $startedAt): void
    {
        [$this->id, $this->platformAdminId, $this->platformAdminName, $this->tenantId, $this->userId, $this->startedAt]
            = [$id, $adminId, $adminName, $tenantId, $userId, $startedAt];
    }

    public function clear(): void
    {
        $this->id = $this->platformAdminId = $this->platformAdminName = $this->tenantId = $this->userId = $this->startedAt = null;
    }

    /** /api/me `impersonation`: nothing but active=false when not impersonating. */
    public function me(): array
    {
        return $this->active() ? ['active' => true, 'platform_admin_name' => $this->platformAdminName,
            'started_at' => $this->startedAt, 'blocked_actions' => self::BLOCKED_ACTIONS] : ['active' => false];
    }
}
