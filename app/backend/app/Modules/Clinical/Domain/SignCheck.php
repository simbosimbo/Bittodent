<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\ProcedureDefinition;
use App\Modules\Clinical\Models\ProcedureRecord;
use App\Modules\Clinical\Models\ToothFinding;
use App\Shared\Terminology\IcdCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

// Combination checks on a visit's draft findings + draft procedures + SOAP codes, run at sign time (codes stay draft until then).
// blocks = sign refused; warnings = sign only with accept_warnings + reason. Official ICD 2010 codes only; titles come from the tables.
final class SignCheck
{
    /** USULAN klinis (bukan standar nasional; perlu ditinjau dokter gigi): ICD-10 diagnosis => ICD-9-CM procedures that rarely fit it. */
    public const MISALIGNED = [
        'K02.0' => ['23.70', '23.71'], // karies email + perawatan saluran akar
    ];

    /**
     * $findings = draft tooth_finding rows (visual: surface/condition fit only); $procedures = draft procedure_record rows (all checks).
     *
     * @return array{blocks: list<array>, warnings: list<array>}
     */
    public static function run(Collection $findings, Collection $procedures, array $soap, string $patientId): array
    {
        $blocks = $warnings = [];
        $issue = fn (string $rule, ?Model $r, string $msg) => ['rule' => $rule, 'finding_id' => $r instanceof ToothFinding ? $r->id : null,
            'procedure_id' => $r instanceof ProcedureRecord ? $r->id : null, 'tooth' => $r?->tooth, 'message' => $msg];
        $missing = self::missingTeeth($patientId, $procedures->pluck('tooth')->filter()->unique()->all());
        $paint = ProcedureDefinition::whereIn('procedure_code', $procedures->pluck('procedure_code')->filter()->unique())->pluck('paint_type', 'procedure_code');

        foreach ($findings as $f) {
            if ($e = Odontogram::error($f->tooth, $f->surface, $f->condition)) {
                $blocks[] = $issue('permukaan', $f, "Gigi {$f->tooth}: $e");
            }
        }
        foreach ($procedures as $p) {
            $where = $p->tooth === null ? 'Tindakan' : "Gigi {$p->tooth}";
            if ($p->tooth !== null && ! Odontogram::validTooth($p->tooth)) {
                $blocks[] = $issue('permukaan', $p, "$where: nomor gigi FDI tidak dikenal.");
            } elseif ($p->surfaces !== null && ($e = Odontogram::surfaces($p->tooth, $p->surfaces)[1])) {
                $blocks[] = $issue('permukaan', $p, "$where: $e");
            }
            if ($p->tooth !== null) {
                // uuid7 ids are time-ordered: an earlier draft finding in this visit already marked the tooth missing
                $markedBefore = $findings->contains(fn ($h) => $h->id < $p->id && $h->tooth === $p->tooth && $h->condition === 'hilang');
                if (($paint[$p->procedure_code] ?? null) !== 'Implant' && (isset($missing[$p->tooth]) || $markedBefore)) {
                    $blocks[] = $issue('gigi_hilang', $p, "Gigi {$p->tooth} tercatat hilang; tindakan pada gigi ini tidak bisa ditandatangani.");
                }
                if ($m = self::dentitionError($p->tooth, $p->procedure_code)) {
                    $blocks[] = $issue('sulung_tetap', $p, $m);
                }
            }
            if ($p->diagnosis_code === null) {
                $warnings[] = $issue('tanpa_diagnosis', $p, "$where: tindakan tanpa kode diagnosis ICD-10.");
            } elseif (in_array($p->procedure_code, self::MISALIGNED[$p->diagnosis_code] ?? [], true)) {
                $warnings[] = $issue('diagnosis_tindakan', $p, "$where: ".self::misalignedText($p->diagnosis_code, $p->procedure_code));
            }
        }
        foreach ($soap['A']['codes'] ?? [] as $dx) {
            foreach (array_intersect($soap['P']['codes'] ?? [], self::MISALIGNED[$dx] ?? []) as $px) {
                $warnings[] = $issue('diagnosis_tindakan', null, 'SOAP: '.self::misalignedText($dx, $px));
            }
        }

        return ['blocks' => $blocks, 'warnings' => $warnings];
    }

    /** Teeth whose current (latest, not superseded) final whole-tooth finding is `hilang`, as [tooth => true]. */
    private static function missingTeeth(string $patientId, array $teeth): array
    {
        if (! $teeth) {
            return [];
        }

        return ToothFinding::where('patient_id', $patientId)->where('state', 'final')->whereNull('surface')->whereIn('tooth', $teeth)
            ->whereNotIn('id', ToothFinding::whereNotNull('supersedes_id')->select('supersedes_id'))
            ->orderBy('created_at')->orderBy('id')->get()->groupBy('tooth')
            ->filter(fn ($rows) => $rows->last()->condition === 'hilang')->map(fn () => true)->all();
    }

    private static function dentitionError(int $tooth, ?string $code): ?string
    {
        $primary = Odontogram::isPrimary($tooth);
        $better = match (true) {
            $code === '23.01' && ! $primary => Odontogram::isThirdMolar($tooth) ? '23.19' : '23.09',
            in_array($code, ['23.09', '23.19'], true) && $primary => '23.01',
            default => null,
        };

        return $better === null ? null : sprintf('Gigi %d adalah gigi %s; %s tidak cocok. Pakai %s.',
            $tooth, $primary ? 'sulung' : 'tetap', self::titled($code), self::titled($better));
    }

    private static function misalignedText(string $dx, string $px): string
    {
        return sprintf('diagnosis %s jarang sejalan dengan tindakan %s (usulan aturan klinik). Periksa lagi.', self::titled($dx, true), self::titled($px));
    }

    /** "23.01 (Extraction of deciduous tooth)": official English display, or the bare code if not in the list. */
    private static function titled(string $code, bool $icd10 = false): string
    {
        $c = $icd10 ? app(IcdCatalog::class)->icd10($code) : app(IcdCatalog::class)->icd9cm($code);

        return $c ? "$code ({$c->display})" : $code;
    }
}
