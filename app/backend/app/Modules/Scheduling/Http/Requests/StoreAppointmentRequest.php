<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission checked by the perm: route middleware
    }

    public function rules(): array
    {
        return [
            'patient_id' => ['required', 'uuid'],
            'chair_id' => ['required', 'uuid'],
            'dentist_id' => ['required', 'uuid'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'reason' => ['nullable', 'string', 'max:300'],
        ];
    }
}
