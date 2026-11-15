<?php

namespace App\Modules\Clinical\Contracts;

use RuntimeException;

final class PlanRefused extends RuntimeException
{
    public const VISIT_CLOSED = 'visit_closed';    // signed note / visit not berlangsung

    public const BRANCH = 'branch';                // visit in a branch the user does not cover

    public const DRAFT_EXISTS = 'draft_exists';    // another draft on the same tooth+surface in this visit

    public const INVALID = 'invalid';              // tooth/surface/condition not valid for the odontogram

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
