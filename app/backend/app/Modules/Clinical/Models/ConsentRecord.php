<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ConsentRecord extends Model
{
    use BelongsToTenant;

    protected $table = 'consent_record';

    protected $guarded = ['tenant_id'];

    protected $casts = ['signed_at' => 'datetime'];
}
