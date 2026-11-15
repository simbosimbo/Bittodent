<?php

namespace App\Modules\IcdSuggestions\Contracts;

use App\Modules\Clinical\Contracts\IcdSystem;

// Exact lookups on the global dictionary (icd_entry).
interface IcdDictionary
{
    public function find(IcdSystem $system, string $code): ?IcdEntry;

    public function exists(IcdSystem $system, string $code): bool;

    /** Distinct version labels loaded for the system (e.g. ['ICD10_2010']). @return list<string> */
    public function versions(IcdSystem $system): array;
}
