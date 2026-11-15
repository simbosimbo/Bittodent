<?php

namespace App\Modules\TreatmentSuggestions\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// Append-only (DB triggers): a change is a new version row. Written only by Services\RuleBook and Domain\RuleTemplate.
class TreatmentRule extends Model
{
    use BelongsToTenant;

    protected $table = 'treatment_rule';

    protected $guarded = ['tenant_id'];

    public $timestamps = false;

    protected $casts = ['surfaces' => 'array', 'active' => 'boolean', 'version' => 'integer', 'priority' => 'integer', 'created_at' => 'datetime'];
}
