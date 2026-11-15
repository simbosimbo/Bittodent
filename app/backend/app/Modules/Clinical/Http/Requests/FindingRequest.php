<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Domain\Soap;
use App\Shared\Terminology\OfficialIcdCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

// POST: tooth + surface + condition. PATCH: condition (tooth/surface come from the stored row; checked in the controller).
class FindingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // perm: route middleware
    }

    public function rules(): array
    {
        $post = $this->isMethod('post');

        return [
            'tooth' => [$post ? 'required' : 'prohibited', 'integer'],
            'surface' => [$post ? 'present' : 'prohibited', 'nullable', 'string', 'in:'.implode(',', Odontogram::SURFACES)],
            'condition' => ['required', 'string', 'in:'.implode(',', [...Odontogram::SURFACE_CONDITIONS, ...Odontogram::WHOLE_CONDITIONS])],
            'source' => ['sometimes', 'string', 'in:manual,ai_draft'],
            'status' => ['sometimes', 'string', 'in:'.implode(',', ProcedureStatus::ALL)],
            'procedure_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD9CM, OfficialIcdCode::icd9cm()],
            'diagnosis_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD10, OfficialIcdCode::icd10()],
            'diagnosis_source' => ['sometimes', 'string', 'in:aturan,riwayat,manual,agen'],
            'variant' => ['sometimes', 'string', 'regex:/^[a-z0-9_]{1,10}$/'], // tariff level code; Clinical cannot see Tariffs (D-035)
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($this->isMethod('post') && ! $v->errors()->any()
                && ($e = Odontogram::error((int) $this->input('tooth'), $this->input('surface'), $this->input('condition')))) {
                $v->errors()->add('surface', $e);
            }
        }];
    }
}
