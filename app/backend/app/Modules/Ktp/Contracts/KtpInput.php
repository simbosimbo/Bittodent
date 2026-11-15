<?php

namespace App\Modules\Ktp\Contracts;

/** User-entered or model-proposed KTP fields. Photo is a tenant-scoped id, never raw bytes. */
final readonly class KtpInput
{
    public function __construct(
        public ?string $nik = null,
        public ?string $name = null,
        public ?string $dateOfBirth = null,   // Y-m-d
        public ?string $sex = null,           // laki_laki | perempuan
        public ?string $provinceCode = null,
        public ?string $regencyCode = null,
        public ?string $districtCode = null,
        public ?string $photoId = null,
    ) {}
}
