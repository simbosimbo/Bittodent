<?php

namespace App\Shared\Http\Middleware;

use App\Shared\Audit\Audit;
use App\Shared\Tenancy\Ctx;
use Closure;
use Illuminate\Http\Request;

// Route guard: ->middleware('perm:patient.read'). Denial => 403 + audit row (inside the tenant transaction).
class RequirePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        return Ctx::current()->can($permission) ? $next($request) : Audit::denied($permission);
    }
}
