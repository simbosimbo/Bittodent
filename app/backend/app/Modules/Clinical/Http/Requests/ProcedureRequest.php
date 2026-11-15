<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Domain\ProcedureCatalog;
use App\Modules\Clinical\Domain\ProcedureStatus;
use App\Modules\Clinical\Domain\Soap;
use App\Shared\Terminology\OfficialIcdCode;
use Illuminate\Foundation\Http\FormRequest;

// POST /api/visits/{id}/procedures and PATCH /api/procedures/{id}. Location (treat_area vs catalog, tooth, surfaces) is checked
// in the controller by ProcedureLocation because it needs the stored row (PATCH) and the tenant catalog.
class ProcedureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // perm: route middleware
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('status')) {
            $this->merge(['status' => ProcedureStatus::normalize($this->input('status'))]); // external => ada_di_tempat_lain
        }
    }

    public function rules(): array
    {
        $post = $this->isMethod('post');

        return [
            'status' => [$post ? 'required' : 'sometimes', 'string', 'in:'.implode(',', ProcedureStatus::WRITABLE)],
            'treat_area' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', ProcedureCatalog::TREAT_AREAS)],
            'tooth' => ['sometimes', 'nullable', 'integer'],
            'surfaces' => ['sometimes', 'nullable'], // "MOD" or ["M","O","D"]; Odontogram::surfaces validates
            'surfaces.*' => ['string', 'size:1'],
            'tooth_range' => ['sometimes', 'nullable', 'string', 'regex:/^[1-8][1-8]-[1-8][1-8]$/'],
            'quadrant' => ['sometimes', 'nullable', 'integer', 'between:1,4'],
            'arch' => ['sometimes', 'nullable', 'string', 'in:atas,bawah'],
            'procedure_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD9CM, OfficialIcdCode::icd9cm()],
            'variant' => ['sometimes', 'string', 'regex:/^[a-z0-9_]{1,10}$/'], // tariff level code; Clinical cannot see Tariffs (D-035)
            'diagnosis_code' => ['bail', 'sometimes', 'nullable', 'string', 'regex:'.Soap::ICD10, OfficialIcdCode::icd10()],
            'diagnosis_source' => ['sometimes', 'string', 'in:aturan,riwayat,manual,agen'],
            'provider_id' => ['sometimes', 'nullable', 'uuid'],
            'source' => ['sometimes', 'string', 'in:manual,ai_draft'],
        ];
    }
}
