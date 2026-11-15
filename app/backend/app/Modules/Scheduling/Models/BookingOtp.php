<?php

namespace App\Modules\Scheduling\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class BookingOtp extends Model
{
    use BelongsToTenant;

    protected $table = 'booking_otp';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['phone_enc', 'phone_bidx', 'complaint_enc', 'code_hash'];

    protected $casts = ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'expires_at' => 'datetime', 'last_sent_at' => 'datetime', 'verified_at' => 'datetime'];
}
