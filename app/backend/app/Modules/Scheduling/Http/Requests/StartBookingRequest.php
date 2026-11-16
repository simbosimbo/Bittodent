<?php

namespace App\Modules\Scheduling\Http\Requests;

use App\Shared\Crypto\Crypto;
use Illuminate\Foundation\Http\FormRequest;

class StartBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public route: tenant from the clinic slug (tenant.public), throttled per IP + per phone
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['phone' => Crypto::normalizePhone($this->input('phone')), 'name' => trim((string) $this->input('name'))]);
    }

    public function rules(): array
    {
        return [
            'dentist_id' => ['required', 'uuid'],
            'service_id' => ['required', 'uuid'],
            'starts_at' => ['required', 'date'],
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'phone' => ['required', 'regex:/^628\d{7,11}$/'], // Indonesian mobile (WhatsApp), normalized to 62...
            'complaint' => ['nullable', 'string', 'max:200'],
        ];
    }

    public function messages(): array
    {
        return ['phone.regex' => 'Nomor WhatsApp tidak valid.', 'phone.required' => 'Nomor WhatsApp wajib diisi.', 'name.*' => 'Nama wajib diisi.'];
    }
}
