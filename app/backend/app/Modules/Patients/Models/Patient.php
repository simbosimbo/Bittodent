<?php

namespace App\Modules\Patients\Models;

use App\Shared\Crypto\Crypto;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use BelongsToTenant;

    protected $table = 'patient';

    protected $guarded = ['tenant_id'];

    protected $hidden = ['nik_enc', 'nik_bidx', 'phone_enc', 'phone_bidx', 'address_enc'];

    protected $casts = ['dob' => 'date:Y-m-d', 'last_visit_at' => 'datetime', 'next_appointment_at' => 'datetime',
        'care_open_visit' => 'boolean', 'care_unfinished_procedure' => 'boolean', 'care_unscheduled_plan' => 'boolean'];

    public static function normalizeName(string $name): string
    {
        return trim(preg_replace('/\s+/', ' ', preg_replace('/[^\p{L}\p{N}\s]/u', '', mb_strtolower($name))));
    }

    /** Under 18 by date of birth (unknown dob = not known to be a minor). Legal age threshold for consent: perlu dicek. */
    public function isMinor(): bool
    {
        return $this->dob !== null && $this->dob->copy()->addYears(18)->isFuture();
    }

    /** Sets name + search key and the encrypted/blind-indexed identifiers. */
    public function fillIdentity(array $d): static
    {
        $nik = Crypto::normalizeNik($d['nik'] ?? null);
        $phone = Crypto::normalizePhone($d['phone'] ?? null);
        $this->forceFill([
            'name' => trim($d['name']),
            'name_normalized' => self::normalizeName($d['name']),
            'nik_enc' => Crypto::encrypt($nik), 'nik_bidx' => Crypto::blindIndex($nik),
            'phone_enc' => Crypto::encrypt($phone), 'phone_bidx' => Crypto::blindIndex($phone),
            'address_enc' => Crypto::encrypt($d['address'] ?? null),
        ]);

        return $this;
    }
}
