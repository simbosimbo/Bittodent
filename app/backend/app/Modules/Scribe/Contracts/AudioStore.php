<?php

namespace App\Modules\Scribe\Contracts;

// Encrypted temp storage for raw dictation audio. Bytes are never logged. After a successful
// transcript + SOAP draft (or after 24h on failure) wipe() removes the ciphertext and records an audit event.
interface AudioStore
{
    /** Persist ciphertext; returns a storage key (not a web path). */
    public function put(string $sessionId, string $plaintext, string $mime): string;

    public function exists(string $sessionId): bool;

    /** Decrypt to a temporary plaintext file for STT, then the caller must delete that temp file. */
    public function openPlaintext(string $sessionId): string;

    /** Irreversibly remove ciphertext. Safe to call twice. Returns true if anything was removed this call. */
    public function wipe(string $sessionId): bool;
}
