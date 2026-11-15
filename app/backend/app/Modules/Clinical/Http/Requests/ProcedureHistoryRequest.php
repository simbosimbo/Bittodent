<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Models\ProcedureCorrection;

// Unit 3. POST /api/procedures/{id}/replace (new work on a restoration's site: direncanakan|selesai on visit_id) and
// POST /api/procedures/{id}/corrections (fix the record; status is not correctable, use /status). Reason required on both.
// Corrections also need reason_type (DEVIATIONS #53); `tidak_dikerjakan` takes no other field (the row is copied with that status).
class ProcedureHistoryRequest extends ProcedureRequest
{
    public const REASON_MIN = 10;

    public function rules(): array
    {
        $replace = str_ends_with($this->path(), '/replace');

        $fields = parent::rules();
        if (! $replace) {
            $fields = array_map(fn ($r) => ['prohibited_if:reason_type,tidak_dikerjakan', ...$r], $fields);
        }

        return [
            ...$fields,
            'reason_type' => $replace ? ['prohibited'] : ['required', 'string', 'in:'.implode(',', ProcedureCorrection::REASON_TYPES)],
            'status' => $replace ? ['required', 'string', 'in:direncanakan,selesai'] : ['prohibited'],
            'visit_id' => $replace ? ['required', 'uuid'] : ['prohibited'],
            'reason' => ['required', 'string', 'min:'.self::REASON_MIN, 'max:500'],
        ];
    }
}
