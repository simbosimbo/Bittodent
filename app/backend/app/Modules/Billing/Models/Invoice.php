<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice';

    protected $guarded = ['tenant_id'];
}
