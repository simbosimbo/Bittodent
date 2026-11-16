<?php

namespace App\Modules\Clinical\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Whether dentist_id is required (non-dentist caller) and valid (active dentist here) is checked in the controller.
class WalkInRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['dentist_id' => ['nullable', 'string', 'max:36'], 'complaint' => ['nullable', 'string', 'max:500']];
    }
}
