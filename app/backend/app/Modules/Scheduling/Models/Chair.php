<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Chair extends Model
{
    use BelongsToTenant;

    protected $table = 'chair';

    protected $guarded = ['tenant_id'];

    protected $casts = ['active' => 'boolean'];

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }
}
