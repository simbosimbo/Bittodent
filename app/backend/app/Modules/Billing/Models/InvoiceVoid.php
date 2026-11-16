<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Request to void an unpaid invoice (unit B). Append-only; needs an owner (BillingDecision) when the invoice has billed lines.
class InvoiceVoid extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_void';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['requires_approval' => 'boolean'];
}
