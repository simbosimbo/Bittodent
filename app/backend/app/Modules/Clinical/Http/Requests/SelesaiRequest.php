<?php

namespace App\Modules\Clinical\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

// `confirm` + `pin` are checked in the controller on purpose: missing confirmation / wrong PIN = 403, not 422.
class SelesaiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['revision' => ['required', 'integer', 'min:1'], 'accept_warnings' => ['sometimes', 'boolean'],
            'reason' => ['required_if_accepted:accept_warnings', 'nullable', 'string', 'min:10', 'max:500']];
    }

    public function confirmed(): bool
    {
        return $this->input('confirm') === true;
    }

    public function pin(): ?string
    {
        return is_string($p = $this->input('pin')) ? $p : null;
    }
}
