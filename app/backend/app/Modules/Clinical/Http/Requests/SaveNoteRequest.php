<?php

namespace App\Modules\Clinical\Http\Requests;

use App\Modules\Clinical\Domain\Soap;
use Illuminate\Foundation\Http\FormRequest;

class SaveNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'revision' => ['nullable', 'integer', 'min:1'], // null only for the first save; stale => 409
            'source' => ['sometimes', 'string', 'in:manual,ai_draft'],
            ...Soap::rules(),
        ];
    }
}
