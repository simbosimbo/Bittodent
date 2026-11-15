<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Http\Controller;
use App\Shared\Permissions\Permissions;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request)
    {
        $ctx = Ctx::current();
        $user = $request->user();
        $branches = Branch::whereNull('archived_at')
            ->when($ctx->branchIds !== null, fn ($q) => $q->whereIn('id', $ctx->branchIds))
            ->orderBy('name')->get(['id', 'name', 'timezone', 'address', 'phone']);
        $active = $branches->firstWhere('id', $ctx->branchId);

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'license_type' => $user->license_type],
            'roles' => $ctx->roles,
            'role_label' => implode(', ', array_map(fn ($r) => Permissions::LABELS[$r], $ctx->roles)),
            'permissions' => Permissions::for($ctx->roles),
            'active' => [
                'tenant_id' => $ctx->tenantId,
                'tenant_name' => $ctx->memberships->firstWhere('tenant_id', $ctx->tenantId)->tenant->name,
                'branch_id' => $ctx->branchId,
                'branch_name' => $active?->name,
                'timezone' => $active?->timezone,
                // Pengaturan Klinik: the branch address, else the clinic address; null = not filled in yet (UI shows the branch name)
                'address' => $active?->address ?? Tenant::whereKey($ctx->tenantId)->value('address'),
            ],
            'branches' => $branches,
            // Selesai (#55): whether this clinic asks for a PIN and whether I have one; never the hash
            'selesai' => ['pin_required' => (bool) Tenant::whereKey($ctx->tenantId)->value('selesai_pin_required'),
                'has_pin' => $user->selesai_pin_hash !== null],
            'memberships' => $ctx->memberships->map(fn ($m) => [
                'tenant_id' => $m->tenant_id, 'tenant_name' => $m->tenant->name, 'branch_id' => $m->branch_id,
                'role' => $m->role, 'role_label' => Permissions::LABELS[$m->role],
            ])->values(),
        ]);
    }

    /** Switch active tenant/branch, only among the user's own memberships. */
    public function switchBranch(Request $request)
    {
        $data = $request->validate(['branch_id' => ['required', 'uuid'], 'tenant_id' => ['nullable', 'uuid']]);
        $ctx = Ctx::current();
        $tenantId = $data['tenant_id'] ?? $ctx->tenantId;
        $mine = $ctx->memberships->where('tenant_id', $tenantId);
        $ok = $mine->contains(fn ($m) => $m->branch_id === null || $m->branch_id === $data['branch_id'])
            && Ctx::runAs($tenantId, fn () => Branch::whereNull('archived_at')->whereKey($data['branch_id'])->exists());
        if (! $ok) {
            return response()->json(['error' => 'not_found', 'message' => 'Cabang tidak ditemukan.'], 404);
        }
        $request->session()->put(['tenant_id' => $tenantId, 'branch_id' => $data['branch_id']]);

        return response()->json(['tenant_id' => $tenantId, 'branch_id' => $data['branch_id']]);
    }
}
