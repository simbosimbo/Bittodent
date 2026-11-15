<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\OdontogramTaxonomy;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Terminology\OfficialIcdCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Odontogram v2 mapping (owner, Pengaturan > Harga): which odontogram condition codes a clinic procedure code records. A finished
// tooth entry ("cof · Selesai") bills the code mapped to its condition. Clinical owns the catalog; Tariffs owns prices (D-035).
class CatalogController extends Controller
{
    private const AREA = ['surface' => ['surface', 'Filling'], 'tooth' => ['tooth', 'Text'], 'span' => ['range', 'Bridge'], 'implant' => ['tooth', 'Implant']];

    /** GET /api/procedure-catalog: every catalog row with its mapped condition codes. */
    public function index()
    {
        return response()->json(ProcedureDefinition::orderBy('procedure_code')->get()
            ->map(fn ($d) => [...$d->only(['procedure_code', 'name', 'treat_area', 'paint_type']), 'conditions' => $d->conditions ?? []])->values());
    }

    /** PUT /api/procedure-catalog/{code}/conditions {conditions: [codes], name?}: a code not yet in the catalog is added (area from the condition). */
    public function update(Request $request, string $code)
    {
        $request->merge(['procedure_code' => $code]);
        $d = $request->validate([
            'procedure_code' => ['bail', 'required', 'string', OfficialIcdCode::icd9cm()],
            'conditions' => ['present', 'array', 'max:12'],
            'conditions.*' => ['string', 'distinct', Rule::in(OdontogramTaxonomy::codes())],
            'name' => ['sometimes', 'string', 'min:2', 'max:200'],
        ]);
        $def = ProcedureDefinition::where('procedure_code', $code)->first();
        if (! $def) {
            $group = collect(OdontogramTaxonomy::conditions())->firstWhere('code', $d['conditions'][0] ?? null)['group'] ?? 'tooth';
            [$area, $paint] = self::AREA[$group];
            $def = ProcedureDefinition::create(['procedure_code' => $code, 'treat_area' => $area, 'paint_type' => $paint, 'name' => $d['name'] ?? $code]);
        }
        $from = $def->conditions ?? [];
        $def->update(['conditions' => array_values($d['conditions'])]);
        Audit::log('ubah_pemetaan_odontogram', 'procedure_definition', $def->id, ['procedure_code' => $code, 'from' => $from, 'to' => $def->conditions]);

        return response()->json([...$def->only(['procedure_code', 'name', 'treat_area', 'paint_type']), 'conditions' => $def->conditions]);
    }
}
