<?php

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Server-side truth of an impersonation (the session only carries this id). Ended once, then frozen (MySQL trigger).
class PlatformImpersonation extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'platform_impersonation';

    protected $guarded = [];

    protected $casts = ['started_at' => 'datetime', 'ended_at' => 'datetime'];

    public function admin()
    {
        return $this->belongsTo(PlatformAdmin::class, 'platform_admin_id');
    }
}
