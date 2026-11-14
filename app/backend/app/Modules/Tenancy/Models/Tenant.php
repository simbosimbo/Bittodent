<?php

namespace App\Modules\Tenancy\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Tenancy root (no tenant_id column). App code reads it only through the user's memberships.
class Tenant extends Model
{
    use HasUuids;

    protected $table = 'tenant';

    protected $guarded = [];
}
