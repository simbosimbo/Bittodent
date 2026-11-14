<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Domain\Odontogram;
use App\Modules\Clinical\Models\ToothBaseline;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;

// Baseline tooth state (first visit): chart dentition + per-tooth presence. Distinct from the condition `hilang` (a finding).
// Versioned: every change = new row (append-only trigger); current = highest version.
class BaselineController extends Controller
{
    public const DENTITIONS = ['tetap', 'sulung', 'campuran'];

    public const TOOTH_STATES = ['ada', 'hilang', 'belum_tumbuh'];

    /** GET /api/patients/{id}/baseline: current + history (newest first). */
    public function show(string $id, PatientDirectory $patients)
    {
        $patients->assertExists($id);
        $rows = ToothBaseline::where('patient_id', $id)->orderByDesc('version')->get();
        Audit::log('baca', 'tooth_baseline', $id);

        return response()->json(['current' => $rows->first() ? self::out($rows->first()) : null, 'history' => $rows->map(self::out(...))]);
    }

    /** PUT /api/patients/{id}/baseline {base_version, dentition, teeth: {"18": "hilang"}} ("ada" entries are dropped). Stale => 409. */
    public function store(Request $request, string $id, PatientDirectory $patients)
    {
        $d = $request->validate([
            'base_version' => ['present', 'nullable', 'integer'],
            'dentition' => ['required', 'in:'.implode(',', self::DENTITIONS)],
            'teeth' => ['present', 'array'],
            'teeth.*' => ['in:'.implode(',', self::TOOTH_STATES)],
        ]);
        $teeth = collect($d['teeth'])->reject(fn ($s) => $s === 'ada')->sortKeys();
        if ($bad = $teeth->keys()->first(fn ($t) => ! ctype_digit((string) $t) || ! Odontogram::validTooth((int) $t))) {
            return response()->json(['message' => "Nomor gigi FDI $bad tidak dikenal.", 'errors' => ['teeth' => ['Nomor gigi FDI tidak dikenal.']]], 422);
        }
        $patients->assertExists($id);
        $current = ToothBaseline::where('patient_id', $id)->orderByDesc('version')->first();
        if (($current?->version) !== $d['base_version']) {
            return response()->json(['error' => 'stale', 'message' => 'Baseline sudah diubah orang lain. Muat ulang dulu.', 'version' => $current?->version], 409);
        }
        try {
            $row = ToothBaseline::create(['patient_id' => $id, 'version' => ($current?->version ?? 0) + 1, 'dentition' => $d['dentition'],
                'teeth' => (object) $teeth->all(), 'created_by' => Ctx::current()->userId]);
        } catch (UniqueConstraintViolationException) { // parallel writer took this version number
            return response()->json(['error' => 'stale', 'message' => 'Baseline sudah diubah orang lain. Muat ulang dulu.'], 409);
        }
        Audit::log('buat', 'tooth_baseline', $row->id, ['version' => $row->version]);

        return response()->json(self::out($row), 201);
    }

    public static function out(ToothBaseline $b): array
    {
        return ['id' => $b->id, 'version' => $b->version, 'dentition' => $b->dentition, 'teeth' => (object) $b->teeth,
            'created_by' => $b->created_by, 'created_at' => $b->created_at];
    }
}
