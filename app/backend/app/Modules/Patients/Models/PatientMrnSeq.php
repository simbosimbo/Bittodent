<?php

namespace App\Modules\Patients\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** One row per tenant: the next No. RM number. Only MrnGenerator touches it. */
class PatientMrnSeq extends Model
{
    use BelongsToTenant;

    protected $table = 'patient_mrn_seq';

    protected $primaryKey = 'tenant_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = ['tenant_id'];

    public function uniqueIds(): array
    {
        return []; // tenant_id comes from the tenant context (BelongsToTenant), never a fresh UUID
    }
}
