<?php

namespace App\Modules\Identity\Services;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\Audit;
use Illuminate\Support\Facades\Hash;

final class UserDirectoryService implements UserDirectory
{
    public function namesByIds(array $ids): array
    {
        return User::whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])->toArray();
    }

    public function hasSelesaiPin(string $userId): bool
    {
        return User::whereKey($userId)->whereNotNull('selesai_pin_hash')->exists();
    }

    public function verifySelesaiPin(string $userId, ?string $pin, string $via): array
    {
        $u = User::lockForUpdate()->findOrFail($userId);
        if ($u->selesai_pin_hash === null) {
            return ['result' => 'no_pin', 'locked_until' => null];
        }
        if ($u->selesai_pin_locked_until?->isFuture()) {
            return ['result' => 'locked', 'locked_until' => $u->selesai_pin_locked_until->toIso8601String()];
        }
        if (is_string($pin) && Hash::check($pin, $u->selesai_pin_hash)) {
            $u->forceFill(['selesai_pin_failures' => 0, 'selesai_pin_locked_until' => null])->save();

            return ['result' => 'ok', 'locked_until' => null];
        }
        $failures = $u->selesai_pin_failures + 1;
        $lock = $failures >= self::PIN_MAX_FAILURES ? now()->addMinutes(self::PIN_LOCK_MINUTES) : null;
        $u->forceFill(['selesai_pin_failures' => $lock ? 0 : $failures, 'selesai_pin_locked_until' => $lock])->save();
        Audit::log('pin_gagal', 'user', $userId, ['via' => $via, 'failures' => $failures]);
        if ($lock) {
            Audit::log('pin_terkunci', 'user', $userId, ['via' => $via, 'until' => $lock->toIso8601String()]);
        }

        return ['result' => $lock ? 'lockout' : 'wrong', 'locked_until' => $lock?->toIso8601String()];
    }

    public function setSelesaiPin(string $userId, string $pin, ?string $current): array
    {
        if ($this->hasSelesaiPin($userId)) {
            $check = $this->verifySelesaiPin($userId, $current, 'ubah_pin');
            if ($check['result'] !== 'ok') {
                return $check;
            }
        }
        User::whereKey($userId)->firstOrFail()->forceFill(['selesai_pin_hash' => Hash::make($pin), 'selesai_pin_failures' => 0,
            'selesai_pin_locked_until' => null])->save();

        return ['result' => 'ok', 'locked_until' => null];
    }
}
