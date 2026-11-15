<?php

namespace App\Modules\ClinicalSummary\Domain;

enum SummaryStatus: string
{
    case Siap = 'siap';
    case Sebagian = 'sebagian';
    case Kosong = 'kosong';
    case Deterministik = 'deterministik';
}
