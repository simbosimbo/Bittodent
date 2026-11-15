<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class InvoiceAdjustment extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_adjustment';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null; // append-only (trigger)

    protected $casts = ['amount_rp' => 'integer', 'requires_approval' => 'boolean'];
}
