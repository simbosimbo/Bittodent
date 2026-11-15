<?php

namespace App\Modules\ClinicalSummary\Domain;

enum Generator: string
{
    case Llm = 'llm';
    case Deterministik = 'deterministik';
}
