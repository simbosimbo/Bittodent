<?php

namespace App\Modules\Platform;

use App\Shared\ModuleServiceProvider;

// Platform superadmin (separate `platform` guard, TOTP mandatory) + impersonation of a clinic's owner. See README.md, DEVIATIONS #61.
class PlatformServiceProvider extends ModuleServiceProvider {}
