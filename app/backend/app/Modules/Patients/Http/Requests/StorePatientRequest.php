<?php

namespace App\Modules\Patients\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePatientRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:200', 'regex:/\p{L}/u'],
            'dob' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after:1900-01-01'],
            'sex' => ['nullable', 'in:laki_laki,perempuan'],
            'nik' => ['nullable', 'string', 'digits:16'],
            'phone' => ['nullable', 'string', 'regex:/^\+?[0-9][0-9 \-]{7,18}$/'],
            'address' => ['nullable', 'string', 'max:500'],
            'home_branch_id' => ['nullable', 'uuid'],
            'payer_type' => ['nullable', 'in:umum,asuransi,bpjs'],
            'payer_name' => ['nullable', 'string', 'max:200'],
            'payer_member_no' => ['nullable', 'string', 'max:64'],
            'payer_class' => ['nullable', 'string', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama lengkap wajib diisi.',
            'nik.digits' => 'NIK harus 16 angka.',
            'phone.regex' => 'Nomor HP tidak valid.',
            'dob.before_or_equal' => 'Tanggal lahir tidak boleh di masa depan.',
        ];
    }
}
