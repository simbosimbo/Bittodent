<?php

namespace App\Modules\ClinicalSummary\Services;

use App\Modules\ClinicalSummary\Domain\Citation;
use App\Modules\ClinicalSummary\Domain\HistoryScope;
use App\Modules\ClinicalSummary\Domain\ModelInput;
use App\Modules\ClinicalSummary\Domain\SourceType;
use App\Modules\ClinicalSummary\Domain\SummarySources;

// Builds the minimal model input (design 3.2): refs N1/F1 instead of ids, relative days instead of dates, age instead of birth date,
// free text scrubbed of names, NIK, phone, email, address, dates and record numbers. Never sent: any UUID, tenant/branch, names,
// urgent note, drafts, billing. Counts replacements (agent_run.redactions), never the values.
final class Pseudonymizer
{
    private const PATTERNS = [
        '/\b(?:\d[\s.-]?){15}\d\b/u' => '[NIK]',                                          // 16 digits (NIK / KK)
        '/(?:\+?62|\b0)[\s.-]?8\d{1,3}(?:[\s.-]?\d{2,4}){2,3}\b/u' => '[TELP]',
        '/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/u' => '[EMAIL]',
        '/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/u' => '[TANGGAL]',
        '/\b\d{4}-\d{2}-\d{2}\b/u' => '[TANGGAL]',
        '/\b\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|agt|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\.?(?:\s+\d{4})?\b/iu' => '[TANGGAL]',
        '/\b(?:no\.?\s*)?(?:RM|MRN)[\s:.#-]*[A-Z0-9-]{3,}\b/iu' => '[NO_RM]',
        '/\bjl\.?\s+[^,.;\n]{2,60}/iu' => '[ALAMAT]',
    ];

    private int $count = 0;

    /**
     * @param  list<string>  $terms  identifying strings from PatientDirectory::redactionTerms + staff names
     * @param  array{dob: ?string, is_minor: bool}  $patient
     */
    public function build(SummarySources $s, HistoryScope $scope, array $terms, array $patient, DeterministicSummarizer $det): ModelInput
    {
        $this->count = 0;
        usort($terms, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a)); // longest first ("Sari Contoh" before "Sari")
        $refs = [];
        $items = [];
        foreach (array_values($s->history['notes']) as $i => $n) {
            $soap = $n['soap'];
            $fields = [
                'S' => $this->scrub((string) ($soap['S'] ?? ''), $terms, $scope),
                'O' => $this->scrub((string) ($soap['O'] ?? ''), $terms, $scope),
                'A' => ['codes' => array_values($soap['A']['codes'] ?? []), 'text' => $this->scrub((string) ($soap['A']['text'] ?? ''), $terms, $scope)],
                'P' => ['codes' => array_values($soap['P']['codes'] ?? []), 'text' => $this->scrub((string) ($soap['P']['text'] ?? ''), $terms, $scope)],
            ];
            $ref = 'N'.($i + 1);
            $refs[$ref] = ['citation' => $det->noteCitation($s, $n), 'fields' => $fields];
            $items[] = ['ref' => $ref, 'type' => SourceType::NoteVersion->value, 'days_ago' => $s->daysAgo($n['signed_at']), 'fields' => $fields];
        }
        foreach (array_values($s->history['findings']) as $i => $f) {
            $fields = ['tooth' => $f['tooth'], 'surface' => $f['surface'], 'condition' => $f['condition'], 'status' => $f['status'], 'procedure_code' => $f['procedure_code']];
            $ref = 'F'.($i + 1);
            $refs[$ref] = ['citation' => new Citation(SourceType::Finding, $f['id'], 1, $f['visit_id'], $s->daysAgo($f['finalized_at'])), 'fields' => $fields];
            $items[] = ['ref' => $ref, 'type' => SourceType::Finding->value, 'days_ago' => $s->daysAgo($f['finalized_at']), 'fields' => $fields];
        }
        $age = $patient['dob'] ? (int) (new \DateTimeImmutable($patient['dob']))->diff($s->now)->y : null;
        $json = json_encode(['patient' => ['age_years' => $age, 'is_minor' => (bool) $patient['is_minor']], 'items' => $items],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        return new ModelInput($json, $refs, $this->count);
    }

    /** @param list<string> $terms longest first */
    public function scrub(string $text, array $terms, HistoryScope $scope): string
    {
        foreach ($terms as $t) {
            $label = preg_match('/^[\p{L}\s.\'-]+$/u', $t) ? '[NAMA]' : '[IDENTITAS]';
            $text = preg_replace('/(?<![\p{L}\p{N}])'.preg_quote($t, '/').'(?![\p{L}\p{N}])/iu', $label, $text, -1, $n);
            $this->count += $n;
        }
        foreach (self::PATTERNS as $re => $label) {
            $text = preg_replace($re, $label, $text, -1, $n);
            $this->count += $n;
        }
        $text = trim(preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > $scope->maxCharsPerNote ? mb_substr($text, 0, $scope->maxCharsPerNote) : $text;
    }
}
