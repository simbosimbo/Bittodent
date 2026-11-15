<?php

namespace App\Modules\Clinical\Http\Requests;

// Unit 3. POST /api/procedures/{id}/replace (new work on a restoration's site: direncanakan|selesai on visit_id) and
// POST /api/procedures/{id}/corrections (fix the record; status is not correctable, use /status). Reason required on both.
class ProcedureHistoryRequest extends ProcedureRequest
{
    public const REASON_MIN = 10;

    public function rules(): array
    {
        $replace = str_ends_with($this->path(), '/replace');

        return [
            ...parent::rules(),
            'status' => $replace ? ['required', 'string', 'in:direncanakan,selesai'] : ['prohibited'],
            'visit_id' => $replace ? ['required', 'uuid'] : ['prohibited'],
            'reason' => ['required', 'string', 'min:'.self::REASON_MIN, 'max:500'],
        ];
    }
}
