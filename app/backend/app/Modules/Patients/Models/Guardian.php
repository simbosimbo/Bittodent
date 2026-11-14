<?php

namespace App\Modules\Patients\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Guardian extends Model
{
    use BelongsToTenant;

    protected $table = 'guardian';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['nik_enc', 'nik_bidx', 'phone_enc', 'phone_bidx'];
}
