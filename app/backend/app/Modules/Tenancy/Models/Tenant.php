<?php

namespace App\Modules\Tenancy\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Tenancy root (no tenant_id column). App code reads it only through the user's memberships, or by slug for the public booking page (PublicTenantContext).
class Tenant extends Model
{
    use HasUuids;

    protected $table = 'tenant';

    protected $guarded = [];

    protected $casts = ['online_booking_enabled' => 'boolean'];
}
