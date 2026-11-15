<?php

namespace App\Modules\Tenancy\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Category (general | specialist) + optional specialist field of a dentist in THIS tenant. No row = general.
class DentistProfile extends Model
{
    use BelongsToTenant;

    protected $table = 'dentist_profile';

    protected $guarded = ['tenant_id'];
}
