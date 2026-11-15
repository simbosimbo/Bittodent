<?php

namespace App\Modules\Clinical\Contracts;

use App\Modules\Clinical\Domain\Soap;

// SATUSEHAT code systems on a SOAP note: ICD-10 (version ICD10_2010) diagnoses in A.codes, ICD-9-CM (ICD9CM_2010) procedures in P.codes.
enum IcdSystem: string
{
    case Icd10 = 'icd10';
    case Icd9cm = 'icd9cm';

    public function version(): string
    {
        return $this === self::Icd10 ? 'ICD10_2010' : 'ICD9CM_2010';
    }

    /** SOAP block the code lands in. */
    public function soapBlock(): string
    {
        return $this === self::Icd10 ? 'A' : 'P';
    }

    public function validFormat(string $code): bool
    {
        return (bool) preg_match($this === self::Icd10 ? Soap::ICD10 : Soap::ICD9CM, $code);
    }
}
