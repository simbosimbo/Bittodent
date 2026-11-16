<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\OdontogramTaxonomy;
use App\Modules\Clinical\Domain\Soap;
use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Terminology\Icd10Code;
use App\Shared\Terminology\OfficialIcdCode;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

// Odontogram v2 mapping (owner, Pengaturan > Harga): which odontogram condition codes a clinic procedure code records. A finished
// tooth entry ("cof · Selesai") bills the code mapped to its condition. Clinical owns the catalog; Tariffs owns prices (D-035).
class CatalogController extends Controller
{
    private const AREA = ['surface' => ['surface', 'Filling'], 'tooth' => ['tooth', 'Text'], 'span' => ['range', 'Bridge'], 'implant' => ['tooth', 'Implant']];

    /** GET /api/procedure-catalog: every catalog row with its mapped condition codes and default diagnosis. */
    public function index()
    {
        $defs = ProcedureDefinition::orderBy('procedure_code')->get();
        $display = self::displays($defs->pluck('default_icd10'));

        return response()->json($defs->map(fn ($d) => self::row($d, $display))->values());
    }

    /**
     * PUT /api/procedure-catalog/{code}/diagnosis {icd10: code|null} (S8): the clinic's default ICD-10 for a procedure saved without a
     * diagnosis. Dentists only (note.sign): pairing a diagnosis with a procedure is a licensed dentist's call, never the owner's or ours.
     */
    public function diagnosis(Request $request, string $code)
    {
        $d = $request->validate(['icd10' => ['bail', 'present', 'nullable', 'string', 'regex:'.Soap::ICD10, OfficialIcdCode::icd10()]]);
        $def = ProcedureDefinition::where('procedure_code', $code)->firstOrFail();
        $from = $def->default_icd10;
        $def->update(['default_icd10' => $d['icd10']]);
        Audit::log('ubah_diagnosis_bawaan', 'procedure_definition', $def->id, ['procedure_code' => $code, 'from' => $from, 'to' => $d['icd10']]);

        return response()->json(self::row($def, self::displays([$def->default_icd10])));
    }

    /** GET /api/icd10?q= : official valid ICD-10 codes by code prefix or title substring, at most 20, by code. */
    public function icd10(Request $request)
    {
        $q = addcslashes($request->validate(['q' => ['required', 'string', 'min:2', 'max:60']])['q'], '%_\\');

        return response()->json(Icd10Code::where('valid', true)
            ->where(fn ($w) => $w->whereLike('code', "$q%")->orWhereLike('display', "%$q%"))
            ->orderBy('code')->limit(20)->get(['code', 'display']));
    }

    private static function row(ProcedureDefinition $d, Collection $display): array
    {
        return [...$d->only(['procedure_code', 'name', 'treat_area', 'paint_type', 'default_icd10']), 'conditions' => $d->conditions ?? [],
            'default_icd10_display' => $display[$d->default_icd10] ?? null];
    }

    /** code => official title (also for a code invalidated later, so the dentist sees what is set). */
    private static function displays(iterable $codes): Collection
    {
        return Icd10Code::whereIn('code', collect($codes)->filter())->pluck('display', 'code');
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

        return response()->json(self::row($def, self::displays([$def->default_icd10])));
    }
}
