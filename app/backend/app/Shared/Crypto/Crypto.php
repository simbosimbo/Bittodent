<?php

namespace App\Shared\Crypto;

use Illuminate\Encryption\Encrypter;
use RuntimeException;

// Per-column encryption (ENCRYPTION_KEY, AES-256-GCM) + HMAC-SHA256 blind index (BLIND_INDEX_KEY), both separate from APP_KEY.
final class Crypto
{
    private static ?Encrypter $encrypter = null;

    public static function encrypt(?string $plain): ?string
    {
        return $plain === null ? null : self::encrypter()->encryptString($plain);
    }

    public static function decrypt(?string $cipher): ?string
    {
        return $cipher === null ? null : self::encrypter()->decryptString($cipher);
    }

    public static function blindIndex(?string $normalized): ?string
    {
        return $normalized === null ? null : hash_hmac('sha256', $normalized, self::key('blind_index_key'));
    }

    public static function normalizeNik(?string $nik): ?string
    {
        $d = preg_replace('/\D/', '', (string) $nik);

        return $d === '' ? null : $d;
    }

    /** Indonesian mobile numbers: 0812..., +62812..., 62812... all become 62812... */
    public static function normalizePhone(?string $phone): ?string
    {
        $d = preg_replace('/\D/', '', (string) $phone);
        if ($d === '') {
            return null;
        }
        if (str_starts_with($d, '0')) {
            return '62'.substr($d, 1);
        }

        return str_starts_with($d, '62') ? $d : '62'.$d;
    }

    private static function encrypter(): Encrypter
    {
        return self::$encrypter ??= new Encrypter(self::key('encryption_key'), 'aes-256-gcm');
    }

    private static function key(string $name): string
    {
        $k = (string) config("ehr.$name");
        if ($k === '') {
            throw new RuntimeException("Kunci ehr.$name belum di-set.");
        }
        $raw = str_starts_with($k, 'base64:') ? base64_decode(substr($k, 7), true) : $k;
        if ($raw === false || strlen($raw) !== 32) {
            throw new RuntimeException("Kunci ehr.$name harus 32 byte.");
        }

        return $raw;
    }
}
