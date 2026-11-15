<?php

namespace App\Modules\Clinical\Domain;

use App\Modules\Clinical\Models\ToothFinding;
use App\Shared\Terminology\IcdCatalog;
use Illuminate\Support\Collection;

// Combination checks on a visit's draft findings + SOAP codes, run at sign time (codes stay draft until then).
// blocks = sign refused; warnings = sign only with accept_warnings + reason. Official ICD 2010 codes only; titles come from the tables.
final class SignCheck
{
    /** USULAN klinis (bukan standar nasional; perlu ditinjau dokter gigi): ICD-10 diagnosis => ICD-9-CM procedures that rarely fit it. */
    public const MISALIGNED = [
        'K02.0' => ['23.70', '23.71'], // karies email + perawatan saluran akar
    ];

    /** @return array{blocks: list<array>, warnings: list<array>} */
    public static function run(Collection $drafts, array $soap, string $patientId): array
    {
        $blocks = $warnings = [];
        $issue = fn (string $rule, ?ToothFinding $f, string $msg) => ['rule' => $rule, 'finding_id' => $f?->id, 'tooth' => $f?->tooth, 'message' => $msg];
        $isProcedure = fn (ToothFinding $f) => $f->procedure_code !== null || $f->status === 'selesai';
        $missing = self::missingTeeth($patientId, $drafts->filter($isProcedure)->pluck('tooth')->unique()->all());

        foreach ($drafts as $f) {
            if ($e = Odontogram::error($f->tooth, $f->surface, $f->condition)) {
                $blocks[] = $issue('permukaan', $f, "Gigi {$f->tooth}: $e");
            }
            if (! $isProcedure($f)) {
                continue;
            }
            // uuid7 ids are time-ordered: an earlier draft in this visit already marked the tooth missing
            $markedBefore = $drafts->contains(fn ($h) => $h->id < $f->id && $h->tooth === $f->tooth && $h->condition === 'hilang');
            if ($f->condition !== 'implan' && (isset($missing[$f->tooth]) || $markedBefore)) {
                $blocks[] = $issue('gigi_hilang', $f, "Gigi {$f->tooth} tercatat hilang; tindakan pada gigi ini tidak bisa ditandatangani.");
            }
            if ($m = self::dentitionError($f->tooth, $f->procedure_code)) {
                $blocks[] = $issue('sulung_tetap', $f, $m);
            }
            if ($f->diagnosis_code === null) {
                $warnings[] = $issue('tanpa_diagnosis', $f, "Gigi {$f->tooth}: tindakan tanpa kode diagnosis ICD-10.");
            } elseif (in_array($f->procedure_code, self::MISALIGNED[$f->diagnosis_code] ?? [], true)) {
                $warnings[] = $issue('diagnosis_tindakan', $f, "Gigi {$f->tooth}: ".self::misalignedText($f->diagnosis_code, $f->procedure_code));
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
