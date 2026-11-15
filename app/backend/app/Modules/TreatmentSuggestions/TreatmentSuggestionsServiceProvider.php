<?php

namespace App\Modules\TreatmentSuggestions;

use App\Shared\ModuleServiceProvider;

// A2: rule-based treatment suggestions from the odontogram (no model). Owns treatment_rule. Reads/writes clinical data only via
// Clinical\Contracts\TreatmentPlan, procedure names via Tariffs\Contracts\ProcedureCatalog (never prices), drafts via Agents.
class TreatmentSuggestionsServiceProvider extends ModuleServiceProvider {}
