<?php

namespace App\Shared\Audit;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Global, append-only platform log (DEVIATIONS #61): everything a platform admin does, incl. on behalf of a clinic user.
// Not a tenant table (clinic = target_tenant_id) and not visible to the clinic. Metadata only.
class PlatformAuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'platform_audit_log';

    protected $guarded = [];

    protected $casts = ['detail' => 'array', 'created_at' => 'datetime'];
}
