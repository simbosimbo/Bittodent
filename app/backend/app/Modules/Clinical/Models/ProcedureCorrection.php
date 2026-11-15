<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

// Correction of a final procedure (DEVIATIONS #53). Append-only (trigger); its outcome is one ProcedureCorrectionDecision row.
// No decision = waiting for the owner (outside the tenant's correction window).
class ProcedureCorrection extends Model
{
    use BelongsToTenant;

    public const REASON_TYPES = ['salah_kode', 'salah_situs', 'salah_provider', 'tidak_dikerjakan'];

    protected $table = 'procedure_correction';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['proposed' => 'array', 'within_window' => 'boolean'];

    protected $hidden = ['reason_enc'];

    public function reason(): string
    {
        return Crypto::decrypt($this->reason_enc);
    }

    public function decision(): HasOne
    {
        return $this->hasOne(ProcedureCorrectionDecision::class, 'correction_id');
    }
}
