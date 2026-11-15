<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// "Perlu tinjau koreksi": a clinical correction (salah_kode/situs/provider) touched this billed line. Append-only.
class LineCorrection extends Model
{
    use BelongsToTenant;

    protected $table = 'line_correction';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    protected $casts = ['billable' => 'array'];
}
