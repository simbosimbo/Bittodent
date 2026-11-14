<?php

namespace App\Modules\Tenancy\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Membership extends Model
{
    use BelongsToTenant;

    protected $table = 'membership';

    protected $guarded = ['tenant_id'];

    protected $casts = ['revoked_at' => 'datetime'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Only scope that may run before a tenant is chosen: the logged-in user lists their own memberships.
    protected function tenantlessOwnerColumn(): ?string
    {
        return 'user_id';
    }
}
