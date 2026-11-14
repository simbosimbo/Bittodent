<?php

namespace App\Modules\Prescriptions\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// state: draft -> signed (locked + printed; DB trigger rejects any later UPDATE/DELETE). Correction = PrescriptionVoid + new row (supersedes_id).
class Prescription extends Model
{
    use BelongsToTenant;

    protected $table = 'prescription';

    protected $guarded = ['tenant_id'];

    protected $casts = ['signed_at' => 'datetime'];
}
