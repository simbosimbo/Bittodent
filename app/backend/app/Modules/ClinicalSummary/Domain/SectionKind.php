<?php

namespace App\Modules\ClinicalSummary\Domain;

enum SectionKind: string
{
    case Keluhan = 'keluhan';
    case Diagnosis = 'diagnosis';
    case Tindakan = 'tindakan';
    case Odontogram = 'odontogram';
    case AlergiObat = 'alergi_obat';
}
