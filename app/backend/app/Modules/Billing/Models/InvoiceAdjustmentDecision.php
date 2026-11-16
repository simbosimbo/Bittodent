<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Owner decision on an adjustment that would bring the balance to Rp0 (unit 4). Append-only (trigger), one per adjustment.
class InvoiceAdjustmentDecision extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_adjustment_decision';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['self_approved_sole_owner' => 'boolean'];
}
