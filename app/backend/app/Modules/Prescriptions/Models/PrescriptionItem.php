<?php

namespace App\Modules\Prescriptions\Models;

use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class PrescriptionItem extends Model
{
    use BelongsToTenant;

    public const REQUIRED = ['dose', 'route', 'frequency', 'duration_days'];

    protected $table = 'prescription_item';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['dosage_enc'];

    /** Structured dosage, encrypted as one JSON blob (health data, not a D-020 code). */
    public function setDosage(array $dosage): static
    {
        foreach (self::REQUIRED as $k) {
            if (($dosage[$k] ?? '') === '') {
                throw new InvalidArgumentException("dosage.$k wajib");
            }
        }
        $this->dosage_enc = Crypto::encrypt(json_encode($dosage, JSON_UNESCAPED_UNICODE));

        return $this;
    }

    public function dosage(): array
    {
        return json_decode(Crypto::decrypt($this->dosage_enc), true);
    }
}
