<?php

namespace App\Modules\TreatmentSuggestions\Http\Controllers;

use App\Modules\Tariffs\Contracts\ProcedureCatalog;
use App\Modules\TreatmentSuggestions\Services\RuleBook;
use App\Shared\Http\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Per-clinic rules (perm treatment_rule.manage). POST = new version; nothing is ever edited in place.
class RuleController extends Controller
{
    public function index(RuleBook $rules, ProcedureCatalog $catalog): JsonResponse
    {
        return response()->json(['rules' => $rules->list(), 'procedures' => $catalog->all()]);
    }

    public function store(Request $request, RuleBook $rules): JsonResponse
    {
        $d = $request->validate([
            'rule_key' => ['required', 'string', 'regex:/^[a-z0-9-]{3,40}$/'],
            'condition' => ['required', 'string', 'max:40'],
            'surfaces' => ['sometimes', 'nullable', 'array', 'max:6'],
            'surfaces.*' => ['string', 'in:M,D,O,I,B,L'],
            'procedure_code' => ['required', 'string', 'max:10'],
            'priority' => ['required', 'integer', 'between:1,999'],
            'active' => ['sometimes', 'boolean'],
        ]);

        return response()->json($rules->write($d['rule_key'], $d), 201);
    }
}
