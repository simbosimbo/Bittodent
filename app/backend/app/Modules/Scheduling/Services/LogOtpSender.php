<?php

namespace App\Modules\Scheduling\Services;

use App\Modules\Scheduling\Contracts\OtpSender;
use Illuminate\Support\Facades\Log;

// Default driver: nothing leaves the system; logs the masked number only (never the code).
class LogOtpSender implements OtpSender
{
    public function send(string $phone, string $code): void
    {
        Log::info('booking_otp_sent', ['to' => self::mask($phone)]);
    }

    /** 6281234567890 => +62812****890 */
    public static function mask(string $phone): string
    {
        return '+'.substr($phone, 0, 5).'****'.substr($phone, -3);
    }
}
