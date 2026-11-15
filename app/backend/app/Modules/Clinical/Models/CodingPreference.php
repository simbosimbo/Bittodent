<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CodingPreference extends Model
{
    use BelongsToTenant;

    protected $table = 'coding_preference';

    protected $guarded = ['tenant_id'];

    protected $casts = ['last_used_at' => 'datetime'];
}
