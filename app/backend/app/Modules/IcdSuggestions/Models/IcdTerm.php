<?php

namespace App\Modules\IcdSuggestions\Models;

use App\Modules\Clinical\Contracts\IcdSystem;
use Illuminate\Database\Eloquent\Model;

// Global (no tenant_id): unofficial Indonesian synonym (icd_synonym) for retrieval only. ehr_app may only SELECT.
class IcdTerm extends Model
{
    protected $table = 'icd_synonym';

    protected $guarded = ['id'];

    protected $casts = ['system' => IcdSystem::class, 'perlu_dicek' => 'boolean'];
}
