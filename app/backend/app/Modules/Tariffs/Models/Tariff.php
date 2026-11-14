<?php

namespace App\Modules\Tariffs\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Tariff extends Model
{
    use BelongsToTenant;

    protected $table = 'tariff';

    protected $guarded = ['tenant_id'];

    protected $casts = ['valid_from' => 'date:Y-m-d', 'price_rp' => 'integer'];
}
