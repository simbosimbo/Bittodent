<?php

namespace App\Modules\Scheduling\Models;

use App\Modules\Scheduling\Domain\AppointmentStatus;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    use BelongsToTenant;

    protected $table = 'appointment';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['complaint_enc', 'manage_token_hash', 'slot_key'];

    protected $casts = ['manage_expires_at' => 'datetime', 'starts_at' => 'datetime', 'ends_at' => 'datetime', 'arrived_at' => 'datetime', 'seated_at' => 'datetime', 'dismissed_at' => 'datetime'];

    protected static function booted(): void
    {
        // Feeds UNIQUE (tenant_id, slot_key): one active appointment per dentist per start time, whatever the channel.
        static::saving(fn (self $a) => $a->slot_key = in_array($a->status ?? 'booked', AppointmentStatus::ACTIVE, true)
            ? $a->dentist_id.'|'.$a->starts_at->utc()->format('Y-m-d H:i:s') : null);
    }

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
