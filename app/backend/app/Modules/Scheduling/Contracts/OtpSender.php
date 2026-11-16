<?php

namespace App\Modules\Scheduling\Contracts;

// Sends a booking OTP to a WhatsApp number (digits, 62...). Driver from config ehr.booking.otp_driver (log | fake);
// a real WhatsApp driver goes through the outbox later (D-011). Implementations never log the code or the full number.
interface OtpSender
{
    public function send(string $phone, string $code): void;
}
