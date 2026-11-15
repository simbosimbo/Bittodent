<?php

namespace App\Modules\Platform\Http\Middleware;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\PlatformImpersonation;
use App\Modules\Platform\Services\ImpersonationSession;
use App\Shared\Audit\Audit;
use App\Shared\Platform\Impersonation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

// Runs on every api (and Fortify) request. If the session carries an impersonation id, it must match an open row, the logged-in
// platform admin (still holding platform.impersonate) and the logged-in clinic user; otherwise the impersonation is ended and the
// clinic login dropped (fail closed: tenant routes then answer 401). Successful GETs on tenant routes are logged as reads.
class LoadImpersonation
{
    /** GET prefixes that show patient / medical-record data. */
    private const PATIENT_READS = ['api/patients', 'api/visits', 'api/notes', 'api/procedures', 'api/procedure-corrections',
        'api/invoices', 'api/schedule', 'api/planned-appointments', 'api/coding-suggestions'];

    public function handle(Request $request, Closure $next)
    {
        if (! $request->hasSession() || ($id = $request->session()->get(ImpersonationSession::KEY)) === null) {
            return $next($request);
        }
        $row = PlatformImpersonation::with('admin')->whereKey($id)->whereNull('ended_at')->first();
        $admin = $row?->admin; // fresh from the DB: a revoked permission ends the impersonation on the next request
        if ($row === null || Auth::guard('platform')->id() !== $row->platform_admin_id
            || ! $admin->hasPermission(PlatformAdmin::IMPERSONATE) || Auth::guard('web')->id() !== $row->target_user_id) {
            ImpersonationSession::end($request, 'sesi_tidak_valid');

            return $next($request);
        }
        ImpersonationSession::load($row, $admin);
        $rid = (string) $request->header('X-Request-Id');
        Impersonation::current()->requestId = preg_match('/^[A-Za-z0-9._-]{1,64}$/', $rid) ? $rid : (string) Str::uuid();

        $response = $next($request);

        if ($request->isMethod('GET') && ! $request->is('api/platform/*') && $response->isSuccessful()) {
            $params = array_values($request->route()?->parameters() ?? []);
            Audit::platform(Str::startsWith($request->path(), self::PATIENT_READS) ? 'platform.patient_read' : 'platform.read',
                $request->route()?->uri(), isset($params[0]) ? (string) $params[0] : null);
        }

        return $response;
    }
}
