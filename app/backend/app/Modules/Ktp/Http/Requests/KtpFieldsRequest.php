<?php

namespace App\Modules\Ktp\Http\Requests;

use App\Modules\Ktp\Contracts\KtpInput;
use Illuminate\Foundation\Http\FormRequest;

// KtpInput fields for POST /api/ktp/check and PUT /api/patients/{id}/ktp. A wrong-length NIK is not a 422 here:
// the check reports it as valid_length=false.
class KtpFieldsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission checked by the perm: route middleware
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->nik)) {
            $this->merge(['nik' => preg_replace('/[\s.-]/', '', $this->nik)]);
        }
    }

    public function rules(): array
    {
        $code = ['nullable', 'string', 'regex:/^\d{1,2}$/'];

        return [
            'nik' => ['nullable', 'string', 'regex:/^\d{1,20}$/'],
            'name' => ['nullable', 'string', 'max:200'],
            'dob' => ['nullable', 'date_format:Y-m-d'],
            'sex' => ['nullable', 'in:laki_laki,perempuan'],
            'province_code' => $code,
            'regency_code' => $code,
            'district_code' => $code,
            'photo_id' => ['nullable', 'uuid'],
        ];
    }

    public function ktpInput(): KtpInput
    {
        $d = $this->validated();
        $pad = fn (?string $v) => $v === null ? null : str_pad($v, 2, '0', STR_PAD_LEFT);

        return new KtpInput($d['nik'] ?? null, $d['name'] ?? null, $d['dob'] ?? null, $d['sex'] ?? null,
            $pad($d['province_code'] ?? null), $pad($d['regency_code'] ?? null), $pad($d['district_code'] ?? null), $d['photo_id'] ?? null);
    }
}
