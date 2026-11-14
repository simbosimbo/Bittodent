<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Domain\Soap;
use Illuminate\Foundation\Http\FormRequest;

class CorrectionRequestBody extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:10', 'max:500'], ...Soap::rules()];
    }
}
