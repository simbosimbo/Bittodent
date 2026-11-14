<?php

namespace App\Modules\Recall\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ReminderLog extends Model
{
    use BelongsToTenant;

    protected $table = 'reminder_log';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null; // append-only (trigger)

    protected $casts = ['scheduled_for' => 'datetime', 'appointment_starts_at' => 'datetime', 'sent_at' => 'datetime'];
}
