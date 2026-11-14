<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BookingSlotsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public route: tenant from the clinic slug (tenant.public), throttled
    }

    public function rules(): array
    {
        return ['dentist_id' => ['required', 'uuid'], 'service_id' => ['required', 'uuid'], 'date' => ['required', 'date_format:Y-m-d']];
    }
}
