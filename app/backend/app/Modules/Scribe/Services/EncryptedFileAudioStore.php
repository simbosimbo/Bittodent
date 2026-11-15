<?php

namespace App\Modules\Scribe\Services;

use App\Modules\Scribe\Contracts\AudioStore;
use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\Ctx;
use Illuminate\Support\Facades\File;

// Ciphertext on the local private disk. Key = tenant/session only; never a web path. Temp plaintext is unlinked by the caller.
final class EncryptedFileAudioStore implements AudioStore
{
    public function put(string $sessionId, string $plaintext, string $mime): string
    {
        $path = $this->path($sessionId);
        File::ensureDirectoryExists(dirname($path), 0700);
        $cipher = Crypto::encrypt(base64_encode($plaintext));
        File::put($path, $cipher, true);
        chmod($path, 0600);

        return $sessionId;
    }

    public function exists(string $sessionId): bool
    {
        return is_file($this->path($sessionId)) && filesize($this->path($sessionId)) > 0;
    }

    public function openPlaintext(string $sessionId): string
    {
        $cipher = File::get($this->path($sessionId));
        $plain = base64_decode((string) Crypto::decrypt($cipher), true);
        if ($plain === false) {
            $plain = '';
        }
        $tmp = tempnam(sys_get_temp_dir(), 'scribe_');
        File::put($tmp, $plain, true);
        chmod($tmp, 0600);

        return $tmp;
    }

    public function wipe(string $sessionId): bool
    {
        $path = $this->path($sessionId);
        if (! is_file($path)) {
            return false;
        }
        File::delete($path);

        return true;
    }

    private function path(string $sessionId): string
    {
        $tenant = Ctx::current()->tenant();

        return storage_path('app/scribe/'.$tenant.'/'.$sessionId.'.bin');
    }
}
