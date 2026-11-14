<?php

namespace App\Modules\Tenancy\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    use BelongsToTenant;

    protected $table = 'branch';

    protected $guarded = ['tenant_id'];

    protected $casts = ['archived_at' => 'datetime'];
}
