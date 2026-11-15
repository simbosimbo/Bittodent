<?php

namespace App\Modules\IcdSuggestions\Contracts;

use App\Modules\Clinical\Contracts\IcdSystem;

// The ONLY way to query the ICD dictionary by text. Now: MySQL (FULLTEXT on display + synonym table). Later: a PostgreSQL
// implementation behind the same interface; callers do not change. Global data (no tenant). Never returns a code that is
// not in the dictionary.
interface IcdSearch
{
    /**
     * Deterministic: same query + same dictionary => same list in the same order.
     * Order: exact code, synonym, synonym with a typo, FULLTEXT on display; ties by matched-term length, more specific code, code.
     *
     * @return list<IcdCandidate> at most $limit (capped at 40)
     */
    public function search(string $query, ?IcdSystem $system = null, int $limit = 40): array;
}
