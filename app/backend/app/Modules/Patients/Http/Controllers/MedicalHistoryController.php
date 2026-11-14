<?php

namespace App\Modules\Patients\Http\Controllers;

use App\Modules\Patients\Models\MedicalHistoryVersion;
use App\Modules\Patients\Models\Patient;
use App\Shared\Audit\Audit;
use App\Shared\Crypto\Crypto;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;

// Medical history + alerts. Never overwritten: every change = new version (append-only trigger), older versions stay readable.
// Content (medications, problems, allergies, urgent note) is health data: encrypted, never logged.
class MedicalHistoryController extends Controller
{
    /** GET /api/patients/{id}/medical-history: current + all versions (newest first). */
    public function show(string $id)
    {
        Patient::findOrFail($id, ['tenant_id', 'id']);
        $rows = MedicalHistoryVersion::where('patient_id', $id)->orderByDesc('version')->get();
        Audit::log('baca', 'medical_history', $id);

        return response()->json(['current' => $rows->first() ? self::out($rows->first()) : null, 'history' => $rows->map(self::out(...))]);
    }

    /** GET /api/patients/{id}/alerts: the compact, always-visible set for the patient header. */
    public function alerts(string $id)
    {
        Patient::findOrFail($id, ['tenant_id', 'id']);
        $v = MedicalHistoryVersion::where('patient_id', $id)->orderByDesc('version')->first();
        Audit::log('baca', 'medical_alerts', $id);
        $c = $v ? self::content($v) : ['allergies' => [], 'problems' => [], 'medications' => [], 'urgent_note' => null];

        $out = ['version' => $v?->version, 'premedication_required' => (bool) $v?->premedication_required, 'allergies' => $c['allergies'],
            'has_urgent_note' => $c['urgent_note'] !== null, 'full' => Ctx::current()->can('note.read')];
        // Minimum necessary: front desk sees allergies + premed + "there is an urgent note"; clinical roles also get the text, problems, medications.
        if ($out['full']) {
            $out += ['urgent_note' => $c['urgent_note'], 'problems' => $c['problems'], 'medications' => $c['medications']];
        }

        return response()->json($out);
    }

    /** PUT /api/patients/{id}/medical-history {base_version, medications[], problems[], allergies[], urgent_note, premedication_required} */
    public function store(Request $request, string $id)
    {
        $list = ['present', 'array', 'max:30'];
        $item = ['string', 'min:1', 'max:200'];
        $d = $request->validate([
            'base_version' => ['present', 'nullable', 'integer'],
            'medications' => $list, 'medications.*' => $item,
            'problems' => $list, 'problems.*' => $item,
            'allergies' => $list, 'allergies.*' => $item,
            'urgent_note' => ['present', 'nullable', 'string', 'max:500'],
            'premedication_required' => ['required', 'boolean'],
        ]);
        Patient::findOrFail($id, ['tenant_id', 'id']);
        $current = MedicalHistoryVersion::where('patient_id', $id)->orderByDesc('version')->first();
        if (($current?->version) !== $d['base_version']) {
            return response()->json(['error' => 'stale', 'message' => 'Riwayat medis sudah diubah orang lain. Muat ulang dulu.', 'version' => $current?->version], 409);
        }
        $content = ['medications' => array_values($d['medications']), 'problems' => array_values($d['problems']),
            'allergies' => array_values($d['allergies']), 'urgent_note' => $d['urgent_note']];
        try {
            $v = MedicalHistoryVersion::create(['patient_id' => $id, 'version' => ($current?->version ?? 0) + 1,
                'content_enc' => Crypto::encrypt(json_encode($content)), 'premedication_required' => $d['premedication_required'],
                'created_by' => Ctx::current()->userId]);
        } catch (UniqueConstraintViolationException) {
            return response()->json(['error' => 'stale', 'message' => 'Riwayat medis sudah diubah orang lain. Muat ulang dulu.'], 409);
        }
        Audit::log('buat', 'medical_history', $v->id, ['version' => $v->version]);

        return response()->json(self::out($v), 201);
    }

    private static function content(MedicalHistoryVersion $v): array
    {
        return json_decode(Crypto::decrypt($v->content_enc), true);
    }

    private static function out(MedicalHistoryVersion $v): array
    {
        return ['id' => $v->id, 'version' => $v->version, 'premedication_required' => $v->premedication_required, ...self::content($v),
            'created_by' => $v->created_by, 'created_at' => $v->created_at];
    }
}
