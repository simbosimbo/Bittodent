<?php

namespace App\Modules\Tenancy\Http\Middleware;

use App\Modules\Tenancy\Models\Tenant;
use App\Shared\Tenancy\Ctx;
use Closure;
use Illuminate\Http\Request;

// Public (no login) routes under /api/public/booking/{clinic}: the tenant comes ONLY from the clinic slug in the URL.
// Same Ctx as TenantContext, so the BelongsToTenant scope keeps every query inside this one tenant; no user, no roles.
class PublicTenantContext
{
    public function handle(Request $request, Closure $next)
    {
        $tenant = Tenant::where('slug', (string) $request->route('clinic'))->first(['id', 'name', 'online_booking_enabled']);
        if ($tenant === null) {
            return response()->json(['error' => 'clinic_not_found', 'message' => 'Klinik tidak ditemukan.'], 404);
        }
        $ctx = new Ctx;
        app()->instance(Ctx::class, $ctx); // fresh per request (scoped binding)
        $ctx->tenantId = $tenant->id;
        $ctx->actorType = 'publik';
        $request->attributes->set('clinic', ['name' => $tenant->name, 'online_booking_enabled' => (bool) $tenant->online_booking_enabled]);

        return $next($request);
    }
}
