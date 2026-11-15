<?php

namespace App\Modules\Ktp\Contracts;

/** Field-level NIK check. mismatches is a list of field keys, never a long message. */
final readonly class NikCheck
{
    /**
     * @param  list<'nik'|'dob'|'sex'|'province'|'regency'|'district'>  $mismatches
     */
    public function __construct(
        public bool $validLength,       // false when NIK is present but not 16 digits
        public array $mismatches = [],
        public ?NikData $parsed = null,
    ) {}

    public function ok(): bool
    {
        return $this->validLength && $this->mismatches === [];
    }
}
