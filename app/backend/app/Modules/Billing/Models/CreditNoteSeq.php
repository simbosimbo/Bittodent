<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Per-tenant, per-year counter for credit note numbers. The one mutable Billing counter (row lock serializes numbering).
class CreditNoteSeq extends Model
{
    use BelongsToTenant;

    protected $table = 'credit_note_seq';

    protected $guarded = ['tenant_id'];

    public $timestamps = false;

    protected $casts = ['year' => 'integer', 'last_number' => 'integer'];
}
