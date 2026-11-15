<?php

namespace App\Modules\IcdSuggestions\Models;

use App\Modules\Clinical\Contracts\IcdSystem;
use App\Modules\IcdSuggestions\Contracts\IcdEntry;
use Illuminate\Database\Eloquent\Model;

// Global (no tenant_id): official ICD dictionary row (icd_entry). ehr_app may only SELECT.
class IcdCode extends Model
{
    protected $table = 'icd_entry';

    protected $guarded = ['id'];

    protected $casts = ['system' => IcdSystem::class, 'perlu_dicek' => 'boolean'];

    public function toEntry(): IcdEntry
    {
        return new IcdEntry($this->system, $this->code, $this->display, $this->version, $this->perlu_dicek);
    }
}
