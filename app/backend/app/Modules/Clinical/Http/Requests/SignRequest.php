<?php

namespace App\Modules\Clinical\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// `confirm` + `code` are checked in the controller on purpose: missing/wrong confirmation = 403, not 422.
class SignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['revision' => ['required', 'integer', 'min:1']];
    }

    public function confirmed(): bool
    {
        return $this->input('confirm') === true && is_string($this->input('code'));
    }
}
