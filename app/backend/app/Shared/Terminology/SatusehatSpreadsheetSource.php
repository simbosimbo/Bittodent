<?php

namespace App\Shared\Terminology;

use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

// Official SATUSEHAT terminology spreadsheets (public Google Sheets export, no credentials). Not the FHIR API (needs OAuth2).
// Source: https://satusehat.kemkes.go.id/platform/docs/id/terminology/ and https://s.kemkes.go.id/databaseICD
final class SatusehatSpreadsheetSource implements IcdSource
{
    public const URLS = [
        'ICD-10' => 'https://docs.google.com/spreadsheets/d/12_72PvHRLWny3VEwodEI6TRDc7QqWdiF/export?format=xlsx',
        'ICD-9-CM' => 'https://docs.google.com/spreadsheets/d/1uw9aEzM61rsp7PVt7dRHt2eATg64qQB_/export?format=xlsx',
    ];

    public function rows(): iterable
    {
        foreach (self::URLS as $label => $url) {
            $tmp = tempnam(sys_get_temp_dir(), 'icd');
            try {
                try {
                    $res = Http::timeout(120)->get($url); // Laravel HTTP client follows redirects by default
                } catch (Throwable $e) {
                    throw new RuntimeException("Unduh $label dari SATUSEHAT gagal ($url): ".$e->getMessage().'. Tidak ada data yang diubah.');
                }
                if (! $res->successful()) {
                    throw new RuntimeException("Unduh $label dari SATUSEHAT gagal (HTTP {$res->status()}): $url. Tidak ada data yang diubah.");
                }
                file_put_contents($tmp, $res->body());
                yield from IcdRows::fromTable(XlsxRows::read($tmp, $label), $label);
            } finally {
                @unlink($tmp);
            }
        }
    }
}
