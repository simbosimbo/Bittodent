<?php

namespace App\Shared\Audit;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AuditEvent extends Model
{
    use BelongsToTenant;

    protected $table = 'audit_event';

    protected $guarded = ['tenant_id'];

    public $timestamps = false;

    protected $casts = ['detail' => 'array', 'occurred_at' => 'datetime'];
}
