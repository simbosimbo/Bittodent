<?php

namespace App\Shared\Terminology;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

// Validation rule: code must exist with valid=true in the official SATUSEHAT 2010 list. Put the format regex before it with
// 'bail': the PK collation is case-insensitive, so the regex is what keeps stored codes in canonical case (k02.1 -> rejected).
final class OfficialIcdCode implements ValidationRule
{
    private function __construct(private bool $icd10) {}

    public static function icd10(): self
    {
        return new self(true);
    }

    public static function icd9cm(): self
    {
        return new self(false);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $catalog = app(IcdCatalog::class);
        if (! is_string($value) || ! ($this->icd10 ? $catalog->icd10Exists($value) : $catalog->icd9cmExists($value))) {
            $fail('Kode '.(is_string($value) ? $value.' ' : '').'tidak ada di daftar resmi SATUSEHAT '.($this->icd10 ? 'ICD-10' : 'ICD-9-CM').' 2010.');
        }
    }
}
