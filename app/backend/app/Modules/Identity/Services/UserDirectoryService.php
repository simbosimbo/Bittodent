<?php

namespace App\Modules\Identity\Services;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Identity\Models\User;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

final class UserDirectoryService implements UserDirectory
{
    public function namesByIds(array $ids): array
    {
        return User::whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])->toArray();
    }

    public function licenseType(string $userId): ?string
    {
        return User::whereKey($userId)->value('license_type');
    }

    public function verifyTotp(string $userId, string $code): bool
    {
        $secret = User::find($userId)?->two_factor_secret;

        return $secret !== null && preg_match('/^\d{6}$/', $code) === 1
            && app(TwoFactorAuthenticationProvider::class)->verify(decrypt($secret), $code);
    }
}
