<?php

namespace App\Modules\Reporting;

use App\Shared\ModuleServiceProvider;

// Read-only owner reports (unit 6). Nothing depends on Reporting; it reads other modules through their Contracts only.
class ReportingServiceProvider extends ModuleServiceProvider {}
