<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Clinical\Services\CodingSuggestions;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CodingSuggestionController extends Controller
{
    /** GET /api/coding-suggestions?condition=&tooth=&surface=&visit_id= (visit_id: sort by that visit's dentist, else by me). */
    public function index(Request $request)
    {
        $d = $request->validate([
            'condition' => ['required', 'string', 'in:'.implode(',', [...Odontogram::SURFACE_CONDITIONS, ...Odontogram::WHOLE_CONDITIONS])],
            'tooth' => ['required', 'integer'],
            'surface' => ['nullable', 'string', 'in:'.implode(',', Odontogram::SURFACES)],
            'visit_id' => ['nullable', 'uuid'],
        ]);
        if (! Odontogram::validTooth((int) $d['tooth'])) {
            throw ValidationException::withMessages(['tooth' => 'Nomor gigi FDI tidak dikenal.']);
        }
        $dentist = isset($d['visit_id']) ? Visit::findOrFail($d['visit_id'])->dentist_id : Ctx::current()->userId;

        return response()->json([
            'suggestions' => CodingSuggestions::for($d['condition'], (int) $d['tooth'], $d['surface'] ?? null, $dentist),
            'notice' => 'Usulan templat klinik, bukan standar nasional; dokter gigi tetap memilih kode.',
        ]);
    }
}
