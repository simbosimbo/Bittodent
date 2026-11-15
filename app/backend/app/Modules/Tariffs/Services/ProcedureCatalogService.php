<?php

namespace App\Modules\Tariffs\Services;

use App\Modules\Tariffs\Contracts\ProcedureCatalog;
use App\Modules\Tariffs\Models\Tariff;

final class ProcedureCatalogService implements ProcedureCatalog
{
    public function names(array $codes): array
    {
        if ($codes === []) {
            return [];
        }

        return Tariff::whereIn('procedure_code', array_values(array_unique($codes)))->orderByDesc('valid_from')->get(['procedure_code', 'name'])
            ->unique('procedure_code')->pluck('name', 'procedure_code')->all();
    }

    public function all(): array
    {
        return Tariff::orderBy('procedure_code')->orderByDesc('valid_from')->get(['procedure_code', 'name'])->unique('procedure_code')
            ->map(fn ($t) => ['code' => $t->procedure_code, 'name' => $t->name])->values()->all();
    }
}
