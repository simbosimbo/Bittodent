<?php

namespace App\Bench\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

// BENCH ONLY. One process-wide listener (php -S reuses the process); reset the counter each request.
class CountQueries
{
    private static int $count = 0;

    private static bool $listening = false;

    public function handle(Request $request, Closure $next): Response
    {
        if (! self::$listening) {
            DB::listen(function () { self::$count++; });
            self::$listening = true;
        }
        self::$count = 0;
        $res = $next($request);
        $res->headers->set('X-Bench-Query-Count', (string) self::$count);

        return $res;
    }
}
