<?php

namespace App\Modules\IcdSuggestions\Domain;

enum SuggestionSource: string
{
    case Deterministik = 'deterministik';   // IcdSearch ranking (free mode, and the fallback)
    case Model = 'model';                   // paid re-pick among IcdSearch candidates only
}
