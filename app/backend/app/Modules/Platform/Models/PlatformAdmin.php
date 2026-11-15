<?php

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;

// Platform superadmin: NOT a tenant user (own table, own `platform` guard, no membership). Created only by seeder/console.
class PlatformAdmin extends Authenticatable
{
    use HasUuids;

    public const IMPERSONATE = 'platform.impersonate';

    protected $table = 'platform_admins';

    protected $fillable = ['name', 'email', 'password', 'totp_secret', 'permissions'];

    protected $hidden = ['password', 'totp_secret'];

    protected $rememberTokenName = ''; // no remember-me column: never a long-lived login cookie

    protected function casts(): array
    {
        return ['password' => 'hashed', 'totp_secret' => 'encrypted', 'permissions' => 'array'];
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions ?? [], true);
    }
}
