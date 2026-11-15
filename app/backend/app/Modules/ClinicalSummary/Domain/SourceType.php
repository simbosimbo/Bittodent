<?php

namespace App\Modules\ClinicalSummary\Domain;

enum SourceType: string
{
    case NoteVersion = 'note_version';
    case Finding = 'finding';
    case Baseline = 'baseline';
    case MedicalHistory = 'medical_history';
    case Prescription = 'prescription';
}
