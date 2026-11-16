<?php

namespace App\Modules\Clinical\Models;

use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

// A treatment (Open Dental procedurelog): one row = one act = one price, whatever its surface count. Final rows are frozen by DB trigger.
class ProcedureRecord extends Model
{
    use BelongsToTenant;

    protected $table = 'procedure_record';

    protected $guarded = ['tenant_id'];

    protected $casts = ['finalized_at' => 'datetime', 'external_confirmed_at' => 'datetime', 'tooth' => 'integer', 'quadrant' => 'integer', 'span_roles' => 'array'];

    /**
     * This row's correction chain, root first, ending with this row: walk back over rows written by a correction (with a reason,
     * not a `superseded` replace marker). Root = the correction window anchor; Billing finds the billed line on one of these rows.
     *
     * @return list<self>
     */
    public function correctionChain(): array
    {
        $rows = [$p = $this];
        while ($p->supersedes_id !== null && $p->reason !== null && $p->status !== ProcedureStatus::SUPERSEDED) {
            array_unshift($rows, $p = self::findOrFail($p->supersedes_id));
        }

        return $rows;
    }
}
