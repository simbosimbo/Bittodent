<?php

namespace App\Modules\Patients\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class MedicalHistoryVersion extends Model
{
    use BelongsToTenant;

    protected $table = 'medical_history_version';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['content_enc'];

    protected $casts = ['premedication_required' => 'boolean'];
}
