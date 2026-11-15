<?php

namespace App\Modules\Ktp\Contracts;

/** Fields encoded in a valid 16-digit NIK (BPS wilayah + date of birth + sex). */
final readonly class NikData
{
    public function __construct(
        public string $nik,            // 16 digits
        public string $provinceCode,   // 2
        public string $regencyCode,    // 2 (kabupaten/kota)
        public string $districtCode,   // 2 (kecamatan)
        public string $dateOfBirth,    // Y-m-d (century inferred; future dates use 19xx)
        public string $sex,            // laki_laki | perempuan (day +40 => perempuan)
    ) {}
}
