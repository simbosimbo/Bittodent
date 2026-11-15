<?php

namespace App\Modules\ClinicalSummary;

use App\Shared\ModuleServiceProvider;

// AI medical summary for the treating dentist (docs/ai/ringkasan-rekam-medis.md). A reading aid, never a medical record:
// stored only as agent_draft kind `ringkasan` (never approvable, purged after expiry). Nothing depends on this module.
class ClinicalSummaryServiceProvider extends ModuleServiceProvider {}
