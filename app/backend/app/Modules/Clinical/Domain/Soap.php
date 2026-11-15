<?php

namespace App\Modules\Clinical\Domain;

use App\Shared\Terminology\OfficialIcdCode;

// SOAP content: S/O free text, A = ICD-10 codes + text, P = optional ICD-9-CM codes + text. Stored encrypted as canonical JSON.
final class Soap
{
    // Fast format check only; the official list (icd10_codes / icd9cm_codes, valid=true) is checked by OfficialIcdCode.
    public const ICD10 = '/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/';

    public const ICD9CM = '/^[0-9]{2}(\.[0-9]{1,2})?$/';

    public static function rules(): array
    {
        $text = ['nullable', 'string', 'max:5000'];

        return [
            'soap' => ['required', 'array'],
            'soap.S' => $text, 'soap.O' => $text,
            'soap.A' => ['nullable', 'array'], 'soap.A.text' => $text,
            'soap.A.codes' => ['nullable', 'array', 'max:10'], 'soap.A.codes.*' => ['bail', 'string', 'regex:'.self::ICD10, OfficialIcdCode::icd10()],
            'soap.P' => ['nullable', 'array'], 'soap.P.text' => $text,
            'soap.P.codes' => ['nullable', 'array', 'max:10'], 'soap.P.codes.*' => ['bail', 'string', 'regex:'.self::ICD9CM, OfficialIcdCode::icd9cm()],
        ];
    }

    /** @return array{S: string, O: string, A: array{codes: list<string>, text: string}, P: array{codes: list<string>, text: string}} */
    public static function normalize(array $in): array
    {
        $block = fn ($b) => ['codes' => array_values(array_unique($b['codes'] ?? [])), 'text' => (string) ($b['text'] ?? '')];

        return ['S' => (string) ($in['S'] ?? ''), 'O' => (string) ($in['O'] ?? ''), 'A' => $block($in['A'] ?? []), 'P' => $block($in['P'] ?? [])];
    }

    /** Sorted keys at every level, no whitespace, unescaped UTF-8: same content => same bytes. */
    public static function canonicalJson(array $soap): string
    {
        $sort = function ($v) use (&$sort) {
            if (! is_array($v)) {
                return $v;
            }
            if (! array_is_list($v)) {
                ksort($v, SORT_STRING);
            }

            return array_map($sort, $v);
        };

        return json_encode($sort($soap), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public static function hash(array $soap): string
    {
        return hash('sha256', self::canonicalJson($soap));
    }
}
