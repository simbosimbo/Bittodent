<?php

namespace App\Shared\Terminology;

// Lookup of official ICD codes. Only valid=true codes count as allowed; invalidated codes stay in the table for history.
class IcdCatalog
{
    public function icd10(string $code): ?Icd10Code
    {
        return Icd10Code::where('code', $code)->where('valid', true)->first();
    }

    public function icd9cm(string $code): ?Icd9cmCode
    {
        return Icd9cmCode::where('code', $code)->where('valid', true)->first();
    }

    public function icd10Exists(string $code): bool
    {
        return Icd10Code::where('code', $code)->where('valid', true)->exists();
    }

    public function icd9cmExists(string $code): bool
    {
        return Icd9cmCode::where('code', $code)->where('valid', true)->exists();
    }
}
