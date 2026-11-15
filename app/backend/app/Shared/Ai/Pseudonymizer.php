<?php

namespace App\Shared\Ai;

// Scrubs free text before it goes to a model: given identifying terms (names, MRN...) plus NIK, phone, email, dates, record
// numbers and street addresses. Counts replacements (agent_run.redactions), never the values. Same patterns as the
// ClinicalSummary pseudonymizer (PR #55), without its domain types.
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

    public int $count = 0;

    /** @param list<string> $terms identifying strings (patient/staff names, MRN); replaced longest first */
    public function scrub(string $text, array $terms = [], int $maxChars = 2000): string
    {
        usort($terms, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a)); // "Sari Contoh" before "Sari"
        foreach (array_filter($terms, fn ($t) => trim($t) !== '') as $t) {
            $label = preg_match('/^[\p{L}\s.\'-]+$/u', $t) ? '[NAMA]' : '[IDENTITAS]';
            $text = preg_replace('/(?<![\p{L}\p{N}])'.preg_quote($t, '/').'(?![\p{L}\p{N}])/iu', $label, $text, -1, $n);
            $this->count += $n;
        }
        foreach (self::PATTERNS as $re => $label) {
            $text = preg_replace($re, $label, $text, -1, $n);
            $this->count += $n;
        }
        $text = trim(preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > $maxChars ? mb_substr($text, 0, $maxChars) : $text;
    }
}
