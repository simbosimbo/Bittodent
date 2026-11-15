<?php

namespace App\Shared\Ai;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// One row per clinic (tenant_id is the key). Same table as A4 (Ktp\Models\ClinicAiSetting): keep only one model after both merge.
class ClinicAiSetting extends Model
{
    use BelongsToTenant;

    protected $table = 'clinic_ai_setting';

    protected $primaryKey = 'tenant_id';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = ['tenant_id'];

    protected $casts = ['paid_enabled' => 'boolean'];

    public function uniqueIds(): array
    {
        return []; // tenant_id comes from the tenant context, not a new uuid
    }
}
