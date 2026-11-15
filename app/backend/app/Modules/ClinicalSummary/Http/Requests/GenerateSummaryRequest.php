<?php

namespace App\Modules\ClinicalSummary\Http\Requests;

use App\Modules\ClinicalSummary\Domain\HistoryScope;
use Illuminate\Foundation\Http\FormRequest;

class GenerateSummaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // perm:summary.generate on the route + licence/treating checks in the controller
    }

    public function rules(): array
    {
        return [
            'scope' => ['sometimes', 'array'],
            'scope.months' => ['sometimes', 'integer', 'between:1,60'],
            'scope.max_visits' => ['sometimes', 'integer', 'between:1,40'],
            'allow_llm' => ['sometimes', 'boolean'],
        ];
    }

    public function scope(): HistoryScope
    {
        return new HistoryScope((int) $this->input('scope.months', 24), (int) $this->input('scope.max_visits', 20));
    }
}
