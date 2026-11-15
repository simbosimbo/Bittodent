<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Money received on an invoice into a clinic account (unit 5). Append-only (trigger + no UPDATE/DELETE grant).
class InvoicePayment extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_payment';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['amount_rp' => 'integer', 'paid_at' => 'datetime'];
}
