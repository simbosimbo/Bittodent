<?php

namespace App\Modules\Prescriptions\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Append-only (trigger). reason_enc = Crypto-encrypted reason (may contain clinical detail).
class PrescriptionVoid extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $table = 'prescription_void';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['reason_enc'];
}
