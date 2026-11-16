<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RescheduleBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public route: the manage-link token is the credential
    }

    public function rules(): array
    {
        return ['starts_at' => ['required', 'date']];
    }
}
