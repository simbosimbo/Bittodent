<?php

namespace App\Modules\Billing\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Nota Kredit (unit B, DEVIATIONS #56): reduces what is owed on ONE invoice line; the line itself never changes. Append-only (trigger).
class CreditNote extends Model
{
    use BelongsToTenant;

    protected $table = 'credit_note';

    protected $guarded = ['tenant_id'];

    public const UPDATED_AT = null;

    public const REASON_TYPES = ['tidak_dikerjakan', 'salah_kode', 'salah_situs', 'salah_provider', 'salah_tarif', 'lainnya'];

    protected $casts = ['amount_rp' => 'integer', 'is_full' => 'boolean', 'requires_approval' => 'boolean'];
}
