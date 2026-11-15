<?php

namespace App\Modules\IcdSuggestions;

use App\Modules\IcdSuggestions\Console\ImportIcdCommand;
use App\Modules\IcdSuggestions\Contracts\IcdDictionary;
use App\Modules\IcdSuggestions\Contracts\IcdSearch;
use App\Modules\IcdSuggestions\Services\DbIcdDictionary;
use App\Modules\IcdSuggestions\Services\MysqlIcdSearch;
use App\Shared\ModuleServiceProvider;

// A1: ICD-10 / ICD-9-CM code suggestions for a visit. Owns the global icd_entry + icd_synonym tables. Reads/writes clinical
// data only via Clinical\Contracts\VisitCoding (draft SOAP codes, never a signature), drafts/runs via Agents\Contracts.
class IcdSuggestionsServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [IcdSearch::class => MysqlIcdSearch::class, IcdDictionary::class => DbIcdDictionary::class];

    public function boot(): void
    {
        parent::boot();
        if ($this->app->runningInConsole()) {
            $this->commands([ImportIcdCommand::class]);
        }
    }
}
