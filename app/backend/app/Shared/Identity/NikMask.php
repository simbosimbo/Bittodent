<?php

namespace App\Shared\Identity;

// NIK display form: first 4 + 8 stars + last 4 (e.g. 3201********0001). Used in API/UI for anyone
// without patient.ktp.view. Never log the unmasked value.
final class NikMask
{
    public static function mask(?string $nik): ?string
    {
        if ($nik === null || $nik === '') {
            return $nik;
        }
        $d = preg_replace('/\D/', '', $nik);
        if (strlen($d) < 8) {
            return str_repeat('*', max(strlen($d), 4));
        }
        if (strlen($d) !== 16) {
            return substr($d, 0, 4).str_repeat('*', max(strlen($d) - 8, 4)).substr($d, -4);
        }

        return substr($d, 0, 4).str_repeat('*', 8).substr($d, -4);
    }
}
