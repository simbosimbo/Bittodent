<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Visit extends Model
{
    use BelongsToTenant;

    protected $table = 'visit';

    protected $guarded = ['tenant_id'];

    protected $casts = ['started_at' => 'datetime', 'ended_at' => 'datetime'];

    /** A signed note locks the visit's drafts (findings + procedures). */
    public function isSigned(): bool
    {
        return ClinicalNote::where('visit_id', $this->id)->whereHas('versions', fn ($q) => $q->where('state', 'signed'))->exists();
    }
}
