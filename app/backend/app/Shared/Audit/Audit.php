<?php

namespace App\Shared\Audit;

use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\JsonResponse;

// Metadata only: never put NIK, phone, address, names or clinical text in detail.
final class Audit
{
    /** Tenant audit row (needs tenant context). */
    public static function log(string $action, string $entityType, ?string $entityId = null, array $detail = []): void
    {
        $ctx = Ctx::current();
        AuditEvent::create([
            'actor_type' => $ctx->actorType,
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
        AuthEvent::create([
            'action' => $action,
            'user_id' => $userId,
            'email_hash' => $email === null ? null : Crypto::blindIndex(strtolower(trim($email))),
            'ip' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 300),
        ]);
    }

    public static function denied(string $permission): JsonResponse
    {
        self::log('akses_ditolak', 'route', null, ['permission' => $permission, 'route' => request()->route()?->uri()]);

        return response()->json(['error' => 'forbidden', 'message' => 'Anda tidak punya izin untuk tindakan ini.'], 403);
    }
}
