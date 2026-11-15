<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\ClinicalNote;
use App\Modules\Clinical\Models\ClinicalNoteVersion;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use Carbon\CarbonInterface;

// Selesai = tanda tangan elektronik tidak tersertifikasi (DEVIATIONS #54). signature_hash = SHA-256 of canonical() over the encounter:
// SOAP + procedures + diagnoses. content_hash stays SOAP-only (#23).
final class SelesaiSignature
{
    public const ATTESTATION_VERSION = 1;

    /** Server-side wording per version; the client only sends confirm=true. Never edit a published version: add a new one. */
    public const ATTESTATIONS = [1 => 'Dengan menekan Selesai, saya menyatakan catatan ini benar.'];

    private const PROCEDURE_FIELDS = ['id', 'procedure_code', 'treat_area', 'tooth', 'surfaces', 'tooth_range', 'quadrant', 'arch', 'status',
        'diagnosis_code', 'provider_id'];

    /**
     * Pure: {diagnoses, procedures, soap, visit_id} with sorted keys (Soap::canonicalJson: no whitespace, unescaped UTF-8).
     * procedures sorted by id; diagnoses = unique sorted SOAP A codes + procedure diagnosis_code + finding diagnosis_code.
     *
     * @param  list<array<string, mixed>>  $procedures  rows with PROCEDURE_FIELDS
     * @param  list<?string>  $findingDiagnoses
     */
    public static function canonical(string $visitId, array $soap, array $procedures, array $findingDiagnoses): string
    {
        $soap = Soap::normalize($soap);
        $procs = array_map(function (array $p) {
            $row = [];
            foreach (self::PROCEDURE_FIELDS as $f) {
                $v = $p[$f] ?? null;
                $row[$f] = $v === null ? null : (in_array($f, ['tooth', 'quadrant'], true) ? (int) $v : (string) $v);
            }

            return $row;
        }, $procedures);
        usort($procs, fn ($a, $b) => strcmp($a['id'], $b['id']));
        $dx = array_values(array_unique(array_filter([...$soap['A']['codes'], ...array_column($procs, 'diagnosis_code'), ...$findingDiagnoses],
            fn ($c) => $c !== null && $c !== '')));
        sort($dx, SORT_STRING);

        return Soap::canonicalJson(['diagnoses' => $dx, 'procedures' => $procs, 'soap' => $soap, 'visit_id' => $visitId]);
    }

    public static function hash(string $canonical): string
    {
        return hash('sha256', $canonical);
    }

    /**
     * Recomputes from stored rows: the visit's final procedures/findings finalized at or before the signature (rows locked by Selesai
     * carry finalized_at = signed_at). Corrections (procedure rows with a reason) are later history, not part of what was signed.
     * shortcut: a status change recorded on this visit in the same second as Selesai would be counted; switch to a stored id list if seen.
     */
    public static function recompute(string $visitId, array $soap, CarbonInterface $signedAt): string
    {
        $procedures = ProcedureRecord::where('visit_id', $visitId)->where('state', 'final')->whereNull('reason')
            ->where('finalized_at', '<=', $signedAt)->get(self::PROCEDURE_FIELDS)->map->getAttributes()->all();
        $findings = ToothFinding::where('visit_id', $visitId)->where('state', 'final')->where('finalized_at', '<=', $signedAt)
            ->pluck('diagnosis_code')->all();

        return self::hash(self::canonical($visitId, $soap, $procedures, $findings));
    }

    /** The Selesai-signed version (v1 normally; corrections are later signed versions without signature_hash). */
    public static function signedVersion(ClinicalNote $note): ?ClinicalNoteVersion
    {
        return $note->versions->where('state', 'signed')->sortBy('version')->first();
    }

    /** GET /visits/{id}/signature and the Selesai response. valid = stored hash equals a fresh recompute (null for pre-#54 signatures). */
    public static function payload(ClinicalNoteVersion $v, string $visitId): array
    {
        $valid = $v->signature_hash === null ? null : hash_equals($v->signature_hash, self::recompute($visitId, $v->soap(), $v->signed_at));

        return ['visit_id' => $visitId, 'version_id' => $v->id, 'signed_by' => $v->signed_by, 'signed_at' => $v->signed_at,
            'signature_hash' => $v->signature_hash, 'content_hash' => $v->content_hash,
            'attestation' => ['version' => $v->attestation_version, 'text' => $v->attestation_text], 'valid' => $valid];
    }
}
