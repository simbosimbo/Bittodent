<?php

namespace App\Modules\Prescriptions;

use App\Modules\Prescriptions\Contracts\PrescriptionHistory;
use App\Modules\Prescriptions\Services\PrescriptionHistoryService;
use App\Shared\ModuleServiceProvider;

// No endpoints yet (see README.md). Read contract PrescriptionHistory for ClinicalSummary.
class PrescriptionsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [PrescriptionHistory::class => PrescriptionHistoryService::class];
}
