<?php

namespace App\Shared\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// Global: HTTPS redirect (staging/production, via ehr.force_https) + browser security headers on every response.
// HSTS only on a request that is already HTTPS (behind a trusted proxy that means X-Forwarded-Proto=https).
class SecurityHeaders
{
    // Built SPA (public/client) loads only its own JS/CSS; React style props are CSSOM (allowed), 'unsafe-inline' only for styles.
    public const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        ."font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    public function handle(Request $request, Closure $next)
    {
        // Health probes from a load balancer may come over plain HTTP inside the platform network.
        if (config('ehr.force_https') && ! $request->isSecure() && ! $request->is('up', 'ready')) {
            return redirect()->secure($request->getRequestUri(), 301);
        }

        $response = $next($request);
        $h = $response->headers;
        $h->set('X-Content-Type-Options', 'nosniff');
        $h->set('X-Frame-Options', 'DENY');
        $h->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $h->set('Content-Security-Policy', self::CSP, false);
        if ($request->isSecure()) {
            $h->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
