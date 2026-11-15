<?php

namespace App\Modules\Ktp\Contracts;

/** Deterministic NIK parse + field comparison. No I/O, no model. */
interface NikValidator
{
    /** null when not 16 digits or the encoded date is illegal. */
    public function parse(string $nik): ?NikData;

    public function check(KtpInput $input): NikCheck;
}
