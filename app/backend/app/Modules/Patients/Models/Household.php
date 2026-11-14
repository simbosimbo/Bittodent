<?php

namespace App\Modules\Patients\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Household extends Model
{
    use BelongsToTenant;

    protected $table = 'household';

    protected $guarded = ['tenant_id'];
}
