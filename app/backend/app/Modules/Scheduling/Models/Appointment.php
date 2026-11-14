<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    use BelongsToTenant;

    protected $table = 'appointment';

    protected $guarded = ['tenant_id'];

    protected $casts = ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'arrived_at' => 'datetime', 'seated_at' => 'datetime', 'dismissed_at' => 'datetime'];

    protected $appends = ['wait_minutes', 'chair_minutes'];

    /** Check-in -> seated (null until both are set). */
    public function getWaitMinutesAttribute(): ?int
    {
        return $this->arrived_at && $this->seated_at ? (int) $this->arrived_at->diffInMinutes($this->seated_at) : null;
    }

    /** Seated -> dismissed. */
    public function getChairMinutesAttribute(): ?int
    {
        return $this->seated_at && $this->dismissed_at ? (int) $this->seated_at->diffInMinutes($this->dismissed_at) : null;
    }
}
