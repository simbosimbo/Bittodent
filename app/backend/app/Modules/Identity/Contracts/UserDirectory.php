<?php

namespace App\Modules\Identity\Contracts;

interface UserDirectory
{
    /** @param list<string> $ids  @return list<array{id: string, name: string}> ordered by name */
    public function namesByIds(array $ids): array;

    /** Fresh TOTP check for a deliberate action (signing). A code is accepted once (Fortify replay cache). */
    public function verifyTotp(string $userId, string $code): bool;
}
