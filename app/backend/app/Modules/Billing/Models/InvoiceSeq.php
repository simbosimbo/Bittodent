<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Per-tenant, per-year counter for invoice numbers (row lock serializes numbering), like CreditNoteSeq.
class InvoiceSeq extends Model
{
    use BelongsToTenant;

    protected $table = 'invoice_seq';

    protected $guarded = ['tenant_id'];

    public $timestamps = false;

    protected $casts = ['year' => 'integer', 'last_number' => 'integer'];
}
