<?php

namespace App\Modules\Patients\Http\Controllers;

use App\Modules\Patients\Models\Guardian;
use App\Modules\Patients\Models\Household;
use App\Modules\Patients\Models\Patient;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Household (keluarga), guarantor (penanggung biaya: another patient pays this patient's bills) and guardians (wali).
// Guardian NIK/phone encrypted + blind-indexed exactly like patient.
class FamilyController extends Controller
{
    public const RELATIONSHIPS = ['ayah', 'ibu', 'kakek_nenek', 'saudara', 'wali_lain'];

    /** GET /api/patients/{id}/family */
    public function show(string $id)
    {
        $p = Patient::findOrFail($id);
        $members = $p->household_id ? Patient::where('household_id', $p->household_id)->orderBy('name')->get(['tenant_id', 'id', 'name', 'dob', 'guarantor_id']) : collect();
        $guarantor = $p->guarantor_id ? Patient::find($p->guarantor_id, ['tenant_id', 'id', 'name']) : null;
        $canNik = Ctx::current()->can('patient.read_nik');
        Audit::log('baca', 'family', $id);

        return response()->json([
            'is_minor' => $p->isMinor(),
            'household' => $p->household_id ? ['id' => $p->household_id, 'name' => Household::find($p->household_id)?->name,
                'members' => $members->map(fn ($m) => $m->only(['id', 'name', 'dob', 'guarantor_id']))] : null,
            'guarantor' => $guarantor?->only(['id', 'name']),
            'guardians' => Guardian::where('patient_id', $id)->orderBy('created_at')->get()->map(fn (Guardian $g) => self::guardian($g, $canNik)),
        ]);
    }

    /** PUT /api/patients/{id}/family {household_id? | household_name?, guarantor_id?} (keys that are absent stay unchanged; null clears). */
    public function update(Request $request, string $id)
    {
        $d = $request->validate([
            'household_id' => ['sometimes', 'nullable', 'uuid'],
            'household_name' => ['sometimes', 'string', 'max:200', 'prohibits:household_id'],
            'guarantor_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        return DB::transaction(function () use ($d, $id) {
            $p = Patient::lockForUpdate()->findOrFail($id);
            if (isset($d['household_name'])) {
                $d['household_id'] = Household::create(['name' => $d['household_name'], 'created_by' => Ctx::current()->userId])->id;
            } elseif (! empty($d['household_id'])) {
                Household::findOrFail($d['household_id']);
            }
            if (! empty($d['guarantor_id'])) {
                $g = Patient::findOrFail($d['guarantor_id']);
                $error = match (true) {
                    $g->id === $p->id => 'Penanggung biaya adalah pasien lain; kosongkan untuk membayar sendiri.',
                    $g->isMinor() => 'Penanggung biaya tidak boleh di bawah umur.',
                    $g->guarantor_id !== null => 'Penanggung biaya ini sendiri ditanggung orang lain; pilih penanggungnya langsung.',
                    default => null,
                };
                if ($error) {
                    return response()->json(['message' => $error, 'errors' => ['guarantor_id' => [$error]]], 422);
                }
            }
            $p->update(array_intersect_key($d, array_flip(['household_id', 'guarantor_id'])));
            Audit::log('ubah', 'patient', $p->id, ['fields' => array_keys($p->getChanges())]);

            return $this->show($id);
        });
    }

    /** POST /api/patients/{id}/guardians {name, relationship, nik?, phone?, guardian_patient_id?} */
    public function addGuardian(Request $request, string $id)
    {
        if (is_string($request->nik)) {
            $request->merge(['nik' => preg_replace('/[\s.-]/', '', $request->nik)]);
        }
        $d = $request->validate([
            'name' => ['required', 'string', 'max:200', 'regex:/\p{L}/u'],
            'relationship' => ['required', 'in:'.implode(',', self::RELATIONSHIPS)],
            'nik' => ['nullable', 'string', 'digits:16'],
            'phone' => ['nullable', 'string', 'regex:/^\+?[0-9][0-9 \-]{7,18}$/'],
            'guardian_patient_id' => ['nullable', 'uuid'],
        ]);
        Patient::findOrFail($id, ['tenant_id', 'id']);
        if (! empty($d['guardian_patient_id'])) {
            Patient::findOrFail($d['guardian_patient_id'], ['tenant_id', 'id']);
        }
        $nik = Crypto::normalizeNik($d['nik'] ?? null);
        $phone = Crypto::normalizePhone($d['phone'] ?? null);
        $g = (new Guardian)->forceFill([
            'patient_id' => $id, 'name' => trim($d['name']), 'relationship' => $d['relationship'], 'guardian_patient_id' => $d['guardian_patient_id'] ?? null,
            'nik_enc' => Crypto::encrypt($nik), 'nik_bidx' => Crypto::blindIndex($nik),
            'phone_enc' => Crypto::encrypt($phone), 'phone_bidx' => Crypto::blindIndex($phone), 'created_by' => Ctx::current()->userId,
        ]);
        $g->save();
        Audit::log('buat', 'guardian', $g->id, ['patient_id' => $id]);

        return response()->json(self::guardian($g, Ctx::current()->can('patient.read_nik')), 201);
    }

    private static function guardian(Guardian $g, bool $canNik): array
    {
        $nik = Crypto::decrypt($g->nik_enc);
        if ($nik !== null && ! $canNik) {
            $nik = str_repeat('*', strlen($nik) - 4).substr($nik, -4);
        }

        return [...$g->only(['id', 'name', 'relationship', 'guardian_patient_id']), 'nik' => $nik, 'phone' => Crypto::decrypt($g->phone_enc)];
    }
}
