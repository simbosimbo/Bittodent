<?php

namespace App\Modules\Integrations\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Outbox extends Model
{
    use BelongsToTenant;

    protected $table = 'outbox';

    protected $guarded = ['tenant_id'];

    // Seam only: SATUSEHAT/WhatsApp sends go through this table (idempotency_key unique per tenant; a worker must
    // hold lease_token to write its result). No worker yet; a job must Ctx::runAs() its tenant.
}
