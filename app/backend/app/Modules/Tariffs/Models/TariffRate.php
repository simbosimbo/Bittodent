<?php

namespace App\Modules\Tariffs\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Explicit price cell above Umum: band specialist | field (+field) | dentist (+dentist_id). Versioned by valid_from/valid_to like tariff.
class TariffRate extends Model
{
    use BelongsToTenant;

    public const BANDS = ['specialist', 'field', 'dentist'];

    protected $table = 'tariff_rate';

    protected $guarded = ['tenant_id'];

    protected $casts = ['valid_from' => 'date:Y-m-d', 'valid_to' => 'date:Y-m-d', 'price_rp' => 'integer'];

    /** Rows effective on $d (Y-m-d): valid_from <= d < valid_to (NULL = open). */
    public function scopeEffective($q, string $d)
    {
        return $q->where('valid_from', '<=', $d)->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $d));
    }
}
