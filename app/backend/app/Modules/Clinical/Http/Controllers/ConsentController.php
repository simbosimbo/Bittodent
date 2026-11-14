<?php

namespace App\Modules\Clinical\Http\Controllers;

use App\Modules\Clinical\Models\ConsentRecord;
use App\Modules\Clinical\Models\Visit;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;

// Minimal consent record (D-012 fields; append-only). The signature image/TTE flow is not built here (Q-5).
// signer = wali requires a guardian of THIS patient (composite FK guardian(tenant_id, id, patient_id)); minors must be signed by a guardian.
class ConsentController extends Controller
{
    /** POST /api/patients/{id}/consents {kind, signer, guardian_id?, document_hash, witness_name?, device?, visit_id?} */
    public function store(Request $request, string $id, PatientDirectory $patients)
    {
        $d = $request->validate([
            'kind' => ['required', 'string', 'max:40', 'regex:/^[a-z_]+$/'],
            'signer' => ['required', 'in:pasien,wali'],
            'guardian_id' => ['required_if:signer,wali', 'prohibited_if:signer,pasien', 'nullable', 'uuid'],
            'document_hash' => ['required', 'string', 'regex:/^[0-9a-f]{64}$/'],
            'witness_name' => ['nullable', 'string', 'max:200'],
            'device' => ['nullable', 'string', 'max:200'],
            'visit_id' => ['nullable', 'uuid'],
        ]);
        $p = $patients->summary($id);
        if ($d['signer'] === 'wali' && ! $patients->guardianBelongsTo($d['guardian_id'], $id)) {
            return response()->json(['message' => 'Wali tidak terdaftar untuk pasien ini.', 'errors' => ['guardian_id' => ['Wali tidak terdaftar.']]], 422);
        }
        if ($d['signer'] === 'pasien' && $p['is_minor']) {
            return response()->json(['message' => 'Pasien di bawah umur: persetujuan ditandatangani wali.', 'errors' => ['signer' => ['Wajib wali.']]], 422);
        }
        if ($d['visit_id'] ?? null) {
            Visit::where('patient_id', $id)->findOrFail($d['visit_id']);
        }
        $c = ConsentRecord::create([...$d, 'patient_id' => $id, 'signed_at' => now(), 'created_by' => Ctx::current()->userId]);
        Audit::log('buat', 'consent_record', $c->id, ['signer' => $c->signer]);

        return response()->json($c->only(['id', 'kind', 'signer', 'guardian_id', 'signed_at']), 201);
    }
}
