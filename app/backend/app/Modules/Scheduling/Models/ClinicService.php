<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ClinicService extends Model
{
    use BelongsToTenant;

    protected $table = 'clinic_service';

    protected $guarded = ['tenant_id'];

    protected $casts = ['online' => 'boolean', 'active' => 'boolean'];
}
