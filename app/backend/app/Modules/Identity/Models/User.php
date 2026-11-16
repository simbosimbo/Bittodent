<?php

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

// Global (non-tenant) login identity. Tenant access comes from `membership`, never from this row.
class User extends Authenticatable
{
    use HasUuids, TwoFactorAuthenticatable;

    protected $fillable = ['name', 'email', 'password', 'license_type'];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'selesai_pin_hash'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'selesai_pin_locked_until' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
