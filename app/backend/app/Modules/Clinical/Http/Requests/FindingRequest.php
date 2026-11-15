<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Domain\Odontogram;
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
            // DEVIATIONS #47: treatments live in procedure_record; a finding is a visual condition (status stays kondisi_pantau)
            'status' => ['sometimes', 'string', 'in:kondisi_pantau'],
            'procedure_code' => ['prohibited'],
            'variant' => ['prohibited'],
            'diagnosis_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD10, OfficialIcdCode::icd10()],
            'diagnosis_source' => ['sometimes', 'string', 'in:aturan,riwayat,manual,agen'],
        ];
    }

    public function messages(): array
    {
        $m = 'Tindakan dicatat lewat POST /api/visits/{id}/procedures, bukan sebagai temuan.';

        return ['status.in' => $m, 'procedure_code.prohibited' => $m, 'variant.prohibited' => $m];
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
