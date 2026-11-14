<?php

namespace App\Modules\Scheduling\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifyOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public route; attempts capped per challenge
    }

    public function rules(): array
    {
        return ['challenge_id' => ['required', 'uuid'], 'code' => $this->routeIs('*.resend') ? ['prohibited'] : ['required', 'digits:6']];
    }
}
