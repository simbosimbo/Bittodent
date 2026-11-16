<?php

namespace App\Modules\Tariffs\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Optional derivation rule (unit B, default OFF): fills an EMPTY Spesialis / bidang cell from the price below it. Never beats an explicit cell.
class TariffRule extends Model
{
    use BelongsToTenant;

    protected $table = 'tariff_rule';

    protected $guarded = ['tenant_id'];

    protected $casts = ['value' => 'integer', 'enabled' => 'boolean'];

    public static function scopeKey(array $r): string
    {
        return implode('|', [$r['band'], $r['field'] ?? '', $r['category'] ?? '', $r['procedure_code'] ?? '', $r['variant'] ?? '']);
    }
}
