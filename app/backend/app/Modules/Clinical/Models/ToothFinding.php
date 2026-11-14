<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ToothFinding extends Model
{
    use BelongsToTenant;

    protected $table = 'tooth_finding';

    protected $guarded = ['tenant_id'];

    protected $casts = ['finalized_at' => 'datetime'];
}
