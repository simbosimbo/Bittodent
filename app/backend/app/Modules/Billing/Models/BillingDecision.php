<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Owner decision on a credit note / void / Rp0-tariff line, or a cashier's "ditinjau" on a line correction. Once per subject; append-only.
class BillingDecision extends Model
{
    use BelongsToTenant;

    protected $table = 'billing_decision';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['self_approved_sole_owner' => 'boolean'];
}
