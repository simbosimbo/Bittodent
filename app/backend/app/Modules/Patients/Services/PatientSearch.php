<?php

namespace App\Modules\Patients\Services;

use App\Modules\Patients\Models\Patient;
use App\Shared\Crypto\Crypto;
use Illuminate\Database\Eloquent\Builder;

// The ONE place that decides how patients are searched (swap point for PostgreSQL search_patient()/trigram).
// MySQL mode: word-prefix LIKE on name_normalized (index (tenant_id, name_normalized(64))); NIK/phone exact via blind index.
// Limits: no substring/typo matching (see migrations/mysql/..._patient_name_prefix_index.php).
final class PatientSearch
{
    public static int $calls = 0; // test probe: proves the API goes through this class

    public static function query(?string $q): Builder
    {
        self::$calls++;
        $query = Patient::query();
        $q = trim((string) $q);
        if ($q === '') {
            return $query;
        }
        $digits = preg_replace('/\D/', '', $q);
        if ($digits !== '' && strlen($digits) >= 8 && preg_match('/^[\d\s+\-.]+$/', $q)) {
            $nik = Crypto::blindIndex(Crypto::normalizeNik($q));
            $phone = Crypto::blindIndex(Crypto::normalizePhone($q));

            return $query->where(fn ($w) => $w->where('nik_bidx', $nik)->orWhere('phone_bidx', $phone));
        }
        $term = Patient::normalizeName($q); // only letters/digits/spaces left: no LIKE wildcards possible
        if ($term === '') {
            return $query->whereIn('id', []);
        }

        return $query->where(fn ($w) => $w->where('name_normalized', 'like', $term.'%')
            ->orWhere('name_normalized', 'like', '% '.$term.'%'));
    }
}
