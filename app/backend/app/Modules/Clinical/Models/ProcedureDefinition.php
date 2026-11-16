<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ProcedureDefinition extends Model
{
    use BelongsToTenant;

    protected $table = 'procedure_definition';

    protected $guarded = ['tenant_id'];

    protected $casts = ['conditions' => 'array']; // odontogram condition codes this procedure code records (v2)
}
