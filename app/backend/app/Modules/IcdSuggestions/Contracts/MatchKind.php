<?php

namespace App\Modules\IcdSuggestions\Contracts;

// Why a candidate came back, strongest first (README "Urutan deterministik").
enum MatchKind: string
{
    case ExactCode = 'exact_code';      // the query contains the code itself
    case Synonym = 'synonym';           // every word of an Indonesian synonym is in the query
    case SynonymTypo = 'synonym_typo';  // same, allowing one typo in words of 5+ letters
    case Fulltext = 'fulltext';         // FULLTEXT hit on the official (English) display

    public function strength(): int
    {
        return match ($this) {
            self::ExactCode => 4, self::Synonym => 3, self::SynonymTypo => 2, self::Fulltext => 1,
        };
    }
}
