<?php

namespace App\Modules\IcdSuggestions\Services;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdDictionary;
use App\Modules\IcdSuggestions\Contracts\IcdEntry;
use App\Modules\IcdSuggestions\Models\IcdCode;

final class DbIcdDictionary implements IcdDictionary
{
    public function find(IcdSystem $system, string $code): ?IcdEntry
    {
        return IcdCode::where('system', $system)->where('code', $code)->first()?->toEntry();
    }

    public function exists(IcdSystem $system, string $code): bool
    {
        return IcdCode::where('system', $system)->where('code', $code)->exists();
    }

    public function versions(IcdSystem $system): array
    {
        return IcdCode::where('system', $system)->distinct()->orderBy('version')->pluck('version')->all();
    }
}
