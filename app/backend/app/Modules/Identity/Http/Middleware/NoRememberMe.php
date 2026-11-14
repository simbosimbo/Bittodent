<?php

namespace App\Modules\Identity\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// "Remember me" is disabled: a shared clinic tablet must not keep a long-lived login cookie.
class NoRememberMe
{
    public function handle(Request $request, Closure $next)
    {
        $request->merge(['remember' => false]);

        return $next($request);
    }
}
