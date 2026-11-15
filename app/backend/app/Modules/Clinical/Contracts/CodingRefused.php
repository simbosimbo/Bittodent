<?php

namespace App\Modules\Clinical\Contracts;

use RuntimeException;

final class CodingRefused extends RuntimeException
{
    public const NOT_FOUND = 'not_found';          // visit not in this tenant

    public const BRANCH = 'branch';                // visit in a branch the user does not cover

    public const VISIT_CLOSED = 'visit_closed';    // signed note / visit not berlangsung

    public const BAD_CODE = 'bad_code';            // code format does not fit the system

    public const TOO_MANY = 'too_many';            // SOAP block already holds the maximum of 10 codes

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
