<?php

namespace App\Modules\Ktp\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// One row per clinic (tenant_id is the key). Missing row = config('ai.paid_ai.default').
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
