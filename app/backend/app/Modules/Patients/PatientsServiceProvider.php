<?php

namespace App\Modules\Patients;

use App\Modules\Patients\Contracts\MedicalHistoryReader;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Modules\Patients\Services\MedicalHistoryReaderService;
use App\Modules\Patients\Services\PatientDirectoryService;
use App\Shared\ModuleServiceProvider;

class PatientsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [PatientDirectory::class => PatientDirectoryService::class, MedicalHistoryReader::class => MedicalHistoryReaderService::class];
}
