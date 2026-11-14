<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ToothBaseline extends Model
{
    use BelongsToTenant;

    protected $table = 'tooth_baseline';

    protected $guarded = ['tenant_id'];

    protected $casts = ['teeth' => 'array'];
}
