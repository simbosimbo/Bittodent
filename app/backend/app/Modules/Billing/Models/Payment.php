<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToTenant;

    protected $table = 'payment';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null; // append-only (trigger)

    public const METHODS = ['tunai', 'transfer', 'kartu', 'qris'];

    protected $casts = ['amount_rp' => 'integer', 'paid_at' => 'datetime'];
}
