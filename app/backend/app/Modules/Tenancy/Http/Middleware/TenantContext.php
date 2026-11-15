<?php

namespace App\Modules\Tenancy\Http\Middleware;

use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Membership;
use App\Shared\Platform\Impersonation;
use App\Shared\Tenancy\Ctx;
use Closure;
use Illuminate\Http\Request;

// Builds the request's tenant context from the user's OWN active memberships + session choice, never from the request body.
// MySQL mode: no RLS / set_config; isolation = BelongsToTenant global scope reading this context.
class TenantContext
{
    public function handle(Request $request, Closure $next)
    {
        $ctx = new Ctx;
        app()->instance(Ctx::class, $ctx); // fresh per request (scoped binding)
        $ctx->userId = (string) $request->user()->getAuthIdentifier();

        $memberships = Membership::with('tenant')->whereNull('revoked_at')->orderBy('created_at')->get();
        $imp = Impersonation::current();
        if ($imp->active()) { // DEVIATIONS #61: pinned to the impersonated clinic, and the target must still be its owner
            $memberships = $memberships->where('tenant_id', $imp->tenantId)->values();
            if (! $memberships->contains('role', 'owner')) {
                return response()->json(['error' => 'impersonation_target_invalid', 'message' => 'Pengguna ini bukan lagi admin klinik ini.'], 403);
            }
        }
        if ($memberships->isEmpty()) {
            return response()->json(['error' => 'no_membership', 'message' => 'Akun ini belum terdaftar di klinik mana pun.'], 403);
        }
        $session = $request->session();
        $tenantId = $memberships->contains('tenant_id', $session->get('tenant_id'))
            ? $session->get('tenant_id') : $memberships->first()->tenant_id;
        $ctx->tenantId = $tenantId;
        $ctx->memberships = $memberships;

        $mine = $memberships->where('tenant_id', $tenantId);
        $ctx->branchIds = $mine->contains(fn ($m) => $m->branch_id === null) ? null : $mine->pluck('branch_id')->unique()->values()->all();

        $branches = Branch::whereNull('archived_at')
            ->when($ctx->branchIds !== null, fn ($q) => $q->whereIn('id', $ctx->branchIds))
            ->orderBy('name')->pluck('id');
        $branchId = $branches->contains($session->get('branch_id')) ? $session->get('branch_id') : $branches->first();
        if ($branchId === null) {
            return response()->json(['error' => 'no_branch', 'message' => 'Tidak ada cabang aktif untuk akun ini.'], 403);
        }
        $ctx->branchId = $branchId;
        $ctx->roles = $mine->filter(fn ($m) => $m->branch_id === null || $m->branch_id === $branchId)
            ->pluck('role')->unique()->values()->all();
        $session->put(['tenant_id' => $tenantId, 'branch_id' => $branchId]);

        return $next($request);
    }
}
