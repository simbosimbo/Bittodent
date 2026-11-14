<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class InvoiceLine extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_line';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null; // append-only (trigger)

    protected $casts = ['price_rp' => 'integer'];
}
