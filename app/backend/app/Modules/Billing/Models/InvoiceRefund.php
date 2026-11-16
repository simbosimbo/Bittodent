<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Money returned from an original payment to the same clinic account (unit C). Append-only (trigger + no UPDATE/DELETE grant).
class InvoiceRefund extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_refund';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['amount_rp' => 'integer'];
}
