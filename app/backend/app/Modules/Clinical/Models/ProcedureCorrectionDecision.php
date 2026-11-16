<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Outcome of a ProcedureCorrection, once: diterapkan (within window) | disetujui | ditolak. Append-only (trigger).
class ProcedureCorrectionDecision extends Model
{
    use BelongsToTenant;

    protected $table = 'procedure_correction_decision';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['self_approved_sole_owner' => 'boolean'];
}
