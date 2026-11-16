<?php

namespace App\Modules\Audit;

use App\Shared\ModuleServiceProvider;

// Read-only audit log view (unit 6). Writer + tables stay in App\Shared\Audit (every module writes audit).
class AuditServiceProvider extends ModuleServiceProvider {}
