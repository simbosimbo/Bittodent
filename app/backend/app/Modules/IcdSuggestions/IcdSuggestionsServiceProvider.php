<?php

namespace App\Modules\IcdSuggestions;

use App\Shared\ModuleServiceProvider;

// A1: ICD-10 / ICD-9-CM code suggestions for a visit. Owns the global icd_entry + icd_synonym tables. Reads/writes clinical
// data only via Clinical\Contracts\VisitCoding (draft SOAP codes, never a signature), drafts/runs via Agents\Contracts.
class IcdSuggestionsServiceProvider extends ModuleServiceProvider {}
