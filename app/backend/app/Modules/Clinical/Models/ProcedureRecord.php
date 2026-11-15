<?php

namespace App\Modules\Clinical\Models;

use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// A treatment (Open Dental procedurelog): one row = one act = one price, whatever its surface count. Final rows are frozen by DB trigger.
class ProcedureRecord extends Model
{
    use BelongsToTenant;

    protected $table = 'procedure_record';

    protected $guarded = ['tenant_id'];

    protected $casts = ['finalized_at' => 'datetime', 'tooth' => 'integer', 'quadrant' => 'integer'];
}
