<?php

namespace App\Modules\Integrations\Contracts;

use RuntimeException;

// The message IS the short reason code (e.g. timeout, quota, not_configured). Never put prompt or reply text in it:
// it is copied to agent_run.error_code and the audit trail.
final class ModelUnavailable extends RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
