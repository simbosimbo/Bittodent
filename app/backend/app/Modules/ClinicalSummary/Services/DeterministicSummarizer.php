<?php

namespace App\Modules\ClinicalSummary\Services;

use App\Modules\ClinicalSummary\Domain\Citation;
use App\Modules\ClinicalSummary\Domain\Generator;
use App\Modules\ClinicalSummary\Domain\SectionKind;
use App\Modules\ClinicalSummary\Domain\SourceType;
use App\Modules\ClinicalSummary\Domain\SummaryClaim;
use App\Modules\ClinicalSummary\Domain\SummarySection;
use App\Modules\ClinicalSummary\Domain\SummarySources;

// No model. Lists structured data verbatim (no paraphrase), each line cited to its record + version.
// Allergies/medication and the current odontogram ALWAYS come from here, even when the LLM path works (design 1.2, 2.6).
final class DeterministicSummarizer
{
    /** @return list<SummarySection> keluhan, diagnosis, tindakan (fallback narrative) */
    public function narrative(SummarySources $s): array
    {
        $out = [SectionKind::Keluhan->value => [], SectionKind::Diagnosis->value => [], SectionKind::Tindakan->value => []];
        foreach ($s->history['notes'] as $n) {
            $cite = [$this->noteCitation($s, $n)];
            $when = $s->daysAgo($n['signed_at']).' hari lalu';
            $soap = $n['soap'];
            if (trim((string) ($soap['S'] ?? '')) !== '') {
                $out['keluhan'][] = new SummaryClaim("$when: ".self::clip($soap['S'], 300), $cite);
            }
            if (($soap['A']['codes'] ?? []) !== [] || trim((string) ($soap['A']['text'] ?? '')) !== '') {
                $out['diagnosis'][] = new SummaryClaim(self::coded($when, $soap['A']), $cite);
            }
            if (($soap['P']['codes'] ?? []) !== [] || trim((string) ($soap['P']['text'] ?? '')) !== '') {
                $out['tindakan'][] = new SummaryClaim(self::coded($when, $soap['P']), $cite);
            }
        }

        return array_map(fn ($k) => new SummarySection(SectionKind::from($k), Generator::Deterministik, $out[$k]), array_keys($out));
    }

    /** @return list<SummarySection> odontogram, alergi_obat */
    public function structured(SummarySources $s): array
    {
        $teeth = [];
        foreach ($s->history['findings'] as $f) {
            $code = $f['procedure_code'] ? " ({$f['procedure_code']})" : '';
            $teeth[] = new SummaryClaim(trim("Gigi {$f['tooth']} ".($f['surface'] ?? '')).": {$f['condition']}, status {$f['status']}$code",
                [new Citation(SourceType::Finding, $f['id'], 1, $f['visit_id'], $s->daysAgo($f['finalized_at']))]);
        }
        if ($b = $s->history['baseline']) {
            $list = implode(', ', array_map(fn ($t, $v) => "$t $v", array_keys($b['teeth']), $b['teeth']));
            $teeth[] = new SummaryClaim("Keadaan dasar gigi ({$b['dentition']})".($list !== '' ? ": $list" : ''),
                [new Citation(SourceType::Baseline, $b['id'], $b['version'], null, $s->daysAgo($b['created_at']))]);
        }

        $med = [];
        if ($m = $s->medical) {
            $c = [new Citation(SourceType::MedicalHistory, $m['id'], $m['version'], null, $s->daysAgo($m['created_at']))];
            $list = fn (array $xs) => $xs === [] ? 'tidak tercatat' : implode(', ', $xs);
            $med[] = new SummaryClaim('Alergi: '.$list($m['allergies']), $c);
            $med[] = new SummaryClaim('Obat yang diminum: '.$list($m['medications']), $c);
            $med[] = new SummaryClaim('Masalah medis: '.$list($m['problems']), $c);
            $med[] = new SummaryClaim('Premedikasi: '.($m['premedication_required'] ? 'perlu' : 'tidak'), $c);
            if ($m['has_urgent_note']) {
                $med[] = new SummaryClaim('Ada catatan penting di riwayat medis. Buka riwayat medis untuk membacanya.', $c);
            }
        }
        foreach ($s->prescriptions as $rx) {
            $med[] = new SummaryClaim('Resep '.$s->daysAgo($rx['signed_at']).' hari lalu: '.implode(', ', $rx['kfa_codes']),
                [new Citation(SourceType::Prescription, $rx['id'], 1, $rx['visit_id'], $s->daysAgo($rx['signed_at']))]);
        }

        return [new SummarySection(SectionKind::Odontogram, Generator::Deterministik, $teeth),
            new SummarySection(SectionKind::AlergiObat, Generator::Deterministik, $med)];
    }

    public function noteCitation(SummarySources $s, array $n): Citation
    {
        return new Citation(SourceType::NoteVersion, $n['id'], $n['version'], $n['visit_id'], $s->daysAgo($n['signed_at']));
    }

    private static function coded(string $when, array $block): string
    {
        $codes = implode(', ', $block['codes'] ?? []);
        $text = self::clip((string) ($block['text'] ?? ''), 300);

        return "$when: ".trim($codes.($codes !== '' && $text !== '' ? ' — ' : '').$text);
    }

    private static function clip(string $s, int $max): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', $s));

        return mb_strlen($s) > $max ? mb_substr($s, 0, $max - 1).'…' : $s;
    }
}
