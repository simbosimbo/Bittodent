<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CodingRule extends Model
{
    use BelongsToTenant;

    protected $table = 'coding_rule';

    protected $guarded = ['tenant_id'];

    protected $casts = ['active' => 'boolean'];
}
