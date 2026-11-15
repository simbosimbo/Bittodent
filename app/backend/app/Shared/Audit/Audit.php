<?php

namespace App\Shared\Audit;

use App\Shared\Crypto\Crypto;
use App\Shared\Platform\Impersonation;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Metadata only: never put NIK, phone, address, names or clinical text in detail.
// Single writer of audit_event / auth_event / platform_audit_log. While a platform admin impersonates a clinic user (DEVIATIONS #61)
// log() and auth() write to platform_audit_log INSTEAD, so nothing is attributed to the clinic user in the clinic's own logs.
final class Audit
{
    /** Tenant audit row (needs tenant context). */
    public static function log(string $action, string $entityType, ?string $entityId = null, array $detail = []): void
    {
        $ctx = Ctx::current();
        if (Impersonation::current()->active()) {
            self::platform($action, $entityType, $entityId, $detail, $ctx->branchId);

            return;
        }
        AuditEvent::create([
            'actor_type' => 'user',
            'actor_id' => $ctx->userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'branch_id' => $ctx->branchId,
            'ip' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 300),
            'detail' => $detail,
        ]);
    }

    /** Pre-tenant auth events (login/logout/failures). Email stored only as HMAC. */
    public static function auth(string $action, ?string $userId, ?string $email = null): void
    {
        if (Impersonation::current()->active()) {
            self::platform('auth.'.$action, 'user', $userId);

            return;
        }
        AuthEvent::create([
            'action' => $action,
            'user_id' => $userId,
            'email_hash' => $email === null ? null : Crypto::blindIndex(strtolower(trim($email))),
            'ip' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 300),
        ]);
    }

    /** Platform log row; the actor is the impersonating admin unless $platformAdminId is given (platform login/logout). */
    public static function platform(string $action, ?string $subjectType = null, ?string $subjectId = null, array $detail = [],
        ?string $branchId = null, ?string $platformAdminId = null): void
    {
        $imp = Impersonation::current();
        $r = request();
        PlatformAuditLog::create([
            'platform_admin_id' => $platformAdminId ?? $imp->platformAdminId,
            'impersonation_id' => $imp->id,
            'on_behalf_of_user_id' => $imp->userId,
            'target_tenant_id' => $imp->tenantId,
            'branch_id' => $branchId,
            'action' => $action,
            'subject_type' => $subjectType === null ? null : substr($subjectType, 0, 120),
            'subject_id' => $subjectId === null ? null : substr($subjectId, 0, 64),
            'detail' => $detail ?: null,
            'ip' => $r->ip(),
            'user_agent' => substr((string) $r->userAgent(), 0, 300),
            'method' => $r->method(),
            'path' => substr($r->path(), 0, 300),
            'request_id' => $imp->requestId,
        ]);
    }

    public static function denied(string $permission): JsonResponse
    {
        self::log('akses_ditolak', 'route', null, ['permission' => $permission, 'route' => request()->route()?->uri()]);

        return response()->json(['error' => 'forbidden', 'message' => 'Anda tidak punya izin untuk tindakan ini.'], 403);
    }
}
