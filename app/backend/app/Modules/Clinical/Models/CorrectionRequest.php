<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Correction after 2x24h (D-013): owner approves, or the solo dentist self-approves with a recorded reason.
class CorrectionRequest extends Model
{
    use BelongsToTenant;

    protected $table = 'correction_request';

    protected $guarded = ['tenant_id'];

    protected $casts = ['approved_at' => 'datetime', 'self_approved' => 'boolean'];

    protected $hidden = ['proposed_soap_enc'];

    public function proposedSoap(): array
    {
        return json_decode(Crypto::decrypt($this->proposed_soap_enc), true, flags: JSON_THROW_ON_ERROR);
    }
}
