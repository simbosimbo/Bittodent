<?php

namespace App\Modules\Agents\Contracts;

use RuntimeException;

final class DraftReviewDenied extends RuntimeException
{
    public const FORBIDDEN = 'forbidden';            // role lacks ai_draft.review

    public const NOT_APPROVABLE = 'not_approvable';  // kind ringkasan

    public const WRONG_STATE = 'wrong_state';        // already reviewed / superseded

    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
