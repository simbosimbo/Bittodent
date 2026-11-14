<?php

namespace App\Bench\Support;

use RuntimeException;

// BENCH/PROTOTYPE of the IMAGING.md envelope: compress-then-encrypt, AES-256-GCM,
// per-file DEK wrapped by a per-tenant KEK (stand-in for KMS), integrity hash in AAD,
// chunked GCM so a viewer can stream after each chunk's tag verifies.
// Not a production KMS. Diagnostic originals must already be lossless-compressed before encrypt().
final class FileEnvelope
{
    public const MAGIC = 'BTD1';

    public const VERSION = 1;

    public const CHUNK = 1_048_576; // 1 MiB plaintext frames

    /** @return array{blob: string, sha256: string, wrapped_bytes: int} */
    public static function encrypt(string $compressedPlain, string $tenantId, string $fileId, string $masterKey32): array
    {
        $sha = hash('sha256', $compressedPlain, true);
        $kek = self::tenantKek($masterKey32, $tenantId);
        $dek = random_bytes(32);
        $wrapIv = random_bytes(12);
        $wrapCt = openssl_encrypt($dek, 'aes-256-gcm', $kek, OPENSSL_RAW_DATA, $wrapIv, $wrapTag, $tenantId, 16);
        if ($wrapCt === false) {
            throw new RuntimeException('KEK wrap failed');
        }
        $fileNonce = random_bytes(8);
        $chunks = '';
        $n = strlen($compressedPlain);
        $idx = 0;
        for ($off = 0; $off < $n; $off += self::CHUNK, $idx++) {
            $slice = substr($compressedPlain, $off, self::CHUNK);
            $iv = $fileNonce.self::u32be($idx);
            $aad = self::aad($fileId, $tenantId, $sha, $idx);
            $ct = openssl_encrypt($slice, 'aes-256-gcm', $dek, OPENSSL_RAW_DATA, $iv, $tag, $aad, 16);
            if ($ct === false) {
                throw new RuntimeException('chunk encrypt failed');
            }
            $chunks .= self::u32be(strlen($ct)).$iv.$tag.$ct;
        }
        $kekId = 'tenant:'.$tenantId;
        $header = self::MAGIC.chr(self::VERSION).chr(strlen($kekId)).$kekId.$wrapIv.$wrapTag.$wrapCt.$fileNonce.self::u32be($idx);
        $blob = $header.$chunks;

        return ['blob' => $blob, 'sha256' => bin2hex($sha), 'wrapped_bytes' => strlen($blob) - $n];
    }

    /** Streaming-friendly: yields verified plaintext chunks in order. */
    public static function decryptChunks(string $blob, string $tenantId, string $fileId, string $expectedSha256Hex, string $masterKey32): \Generator
    {
        $p = 0;
        if (substr($blob, 0, 4) !== self::MAGIC) {
            throw new RuntimeException('bad magic');
        }
        $p = 4;
        $ver = ord($blob[$p++]);
        if ($ver !== self::VERSION) {
            throw new RuntimeException('unsupported version '.$ver);
        }
        $kekLen = ord($blob[$p++]);
        $kekId = substr($blob, $p, $kekLen);
        $p += $kekLen;
        if ($kekId !== 'tenant:'.$tenantId) {
            throw new RuntimeException('KEK id mismatch');
        }
        $wrapIv = substr($blob, $p, 12);
        $p += 12;
        $wrapTag = substr($blob, $p, 16);
        $p += 16;
        $wrapCt = substr($blob, $p, 32);
        $p += 32;
        $kek = self::tenantKek($masterKey32, $tenantId);
        $dek = openssl_decrypt($wrapCt, 'aes-256-gcm', $kek, OPENSSL_RAW_DATA, $wrapIv, $wrapTag, $tenantId);
        if ($dek === false || strlen($dek) !== 32) {
            throw new RuntimeException('KEK unwrap failed');
        }
        $fileNonce = substr($blob, $p, 8);
        $p += 8;
        $nChunks = self::readU32($blob, $p);
        $p += 4;
        $sha = hex2bin($expectedSha256Hex);
        $h = hash_init('sha256');
        for ($i = 0; $i < $nChunks; $i++) {
            $ctLen = self::readU32($blob, $p);
            $p += 4;
            $iv = substr($blob, $p, 12);
            $p += 12;
            $tag = substr($blob, $p, 16);
            $p += 16;
            $ct = substr($blob, $p, $ctLen);
            $p += $ctLen;
            if (substr($iv, 0, 8) !== $fileNonce) {
                throw new RuntimeException('nonce mismatch');
            }
            $plain = openssl_decrypt($ct, 'aes-256-gcm', $dek, OPENSSL_RAW_DATA, $iv, $tag, self::aad($fileId, $tenantId, $sha, $i));
            if ($plain === false) {
                throw new RuntimeException('chunk '.$i.' tag failed');
            }
            hash_update($h, $plain);
            yield $plain;
        }
        if (hash_final($h, true) !== $sha) {
            throw new RuntimeException('integrity hash mismatch');
        }
    }

    public static function decrypt(string $blob, string $tenantId, string $fileId, string $expectedSha256Hex, string $masterKey32): string
    {
        $out = '';
        foreach (self::decryptChunks($blob, $tenantId, $fileId, $expectedSha256Hex, $masterKey32) as $c) {
            $out .= $c;
        }

        return $out;
    }

    public static function masterKeyFromConfig(): string
    {
        $k = (string) config('ehr.encryption_key');
        $raw = str_starts_with($k, 'base64:') ? base64_decode(substr($k, 7), true) : $k;
        if ($raw === false || strlen($raw) !== 32) {
            throw new RuntimeException('ENCRYPTION_KEY must be 32 bytes (bench KEK root only).');
        }

        return $raw;
    }

    private static function tenantKek(string $master, string $tenantId): string
    {
        return hash_hmac('sha256', 'bittodent:kek:v1:'.$tenantId, $master, true);
    }

    private static function aad(string $fileId, string $tenantId, string $sha32, int $idx): string
    {
        return 'bittodent:v1:'.$fileId.':'.$tenantId.':'.bin2hex($sha32).':'.$idx;
    }

    private static function u32be(int $n): string
    {
        return pack('N', $n);
    }

    private static function readU32(string $s, int $p): int
    {
        $u = unpack('N', substr($s, $p, 4));

        return $u[1];
    }
}
