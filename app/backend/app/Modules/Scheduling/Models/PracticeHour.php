<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PracticeHour extends Model
{
    use BelongsToTenant;

    protected $table = 'practice_hour';

    protected $guarded = ['tenant_id'];
}
