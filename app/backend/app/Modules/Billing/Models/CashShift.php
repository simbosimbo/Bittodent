<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CashShift extends Model
{
    use BelongsToTenant;

    protected $table = 'cash_shift';

    protected $guarded = ['tenant_id'];

    protected $casts = ['opened_at' => 'datetime', 'closed_at' => 'datetime', 'summary' => 'array', 'opening_cash_rp' => 'integer',
        'expected_cash_rp' => 'integer', 'counted_cash_rp' => 'integer', 'difference_rp' => 'integer'];
}
