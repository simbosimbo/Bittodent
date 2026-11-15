<?php

namespace App\Modules\Scheduling\Services;

use App\Shared\Crypto\Crypto;
use Illuminate\Support\Facades\Cache;

// Dev/test driver: like `log`, plus keeps the last code per number in the cache (key = blind index, 5 min) so tests and
// `php artisan booking:otp <nomor>` can read it. Refused in production (SchedulingServiceProvider).
class FakeOtpSender extends LogOtpSender
{
    public function send(string $phone, string $code): void
    {
        parent::send($phone, $code);
        Cache::put(self::key($phone), $code, 300);
    }

    public static function lastCode(string $phone): ?string
    {
        return Cache::get(self::key(Crypto::normalizePhone($phone)));
    }

    private static function key(string $phone): string
    {
        return 'booking-otp-fake:'.Crypto::blindIndex($phone);
    }
}
