<?php

namespace App\Modules\IcdSuggestions\Contracts;

use App\Modules\Clinical\Contracts\IcdSystem;

// Unofficial Indonesian / colloquial gloss used for retrieval only (e.g. "gigi berlubang" -> K02.1). Never shown as the
// official title. The code must exist in the dictionary (FK). Always an example until checked (perlu dicek).
final readonly class IcdSynonym
{
    public function __construct(
        public string $term,
        public IcdSystem $system,
        public string $code,
        public bool $perluDicek = true,
    ) {}
}
