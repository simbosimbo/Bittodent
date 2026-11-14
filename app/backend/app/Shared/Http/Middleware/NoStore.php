<?php

namespace App\Shared\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// API responses carry patient data: never let a browser/proxy cache them.
class NoStore
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
