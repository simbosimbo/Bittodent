<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PlannedAppointment extends Model
{
    use BelongsToTenant;

    protected $table = 'planned_appointment';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['procedure_enc', 'note_enc'];
}
