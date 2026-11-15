<?php

namespace App\Shared\Terminology;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

// ICD lists through the SATUSEHAT FHIR R4 API (OAuth2 client_credentials). As of 15 Nov 2026 the official API catalogue does
// NOT document CodeSystem/ValueSet or a full ICD download; this only tries the standard FHIR terminology reads and fails
// (nothing written) if the server does not answer them. The documented full list is SatusehatSpreadsheetSource.
// Token: https://satusehat.kemkes.go.id/platform/docs/id/api-catalogue/authentication/apis/token/
final class SatusehatApiSource implements IcdSource
{
    public const BASES = [
        'sandbox' => 'https://api-satusehat-stg.dto.kemkes.go.id',
        'production' => 'https://api-satusehat.kemkes.go.id',
    ];

    // FHIR system URL => our table version. A resource without `version` gets the SATUSEHAT-documented 2010 version
    // (https://satusehat.kemkes.go.id/platform/docs/id/terminology/).
    public const SYSTEMS = [
        'http://hl7.org/fhir/sid/icd-10' => 'ICD10_2010',
        'http://hl7.org/fhir/sid/icd-9-cm' => 'ICD9CM_2010',
    ];

    public const ENV_VARS = ['SATUSEHAT_ENV', 'SATUSEHAT_CLIENT_ID', 'SATUSEHAT_CLIENT_SECRET', 'SATUSEHAT_ORG_ID'];

    private const PAGE = 1000;

    /** @param array{env?: string, client_id?: ?string, client_secret?: ?string, org_id?: ?string} $config */
    public function __construct(private array $config) {}

    /** @return list<string> env vars that are empty or invalid (org_id is not sent here, but one client_id belongs to one org) */
    public function missing(): array
    {
        $bad = isset(self::BASES[$this->config['env'] ?? '']) ? [] : ['SATUSEHAT_ENV'];
        foreach (['client_id', 'client_secret', 'org_id'] as $k) {
            if (blank($this->config[$k] ?? null)) {
                $bad[] = 'SATUSEHAT_'.strtoupper($k);
            }
        }

        return $bad;
    }

    public function rows(): iterable
    {
        $base = self::BASES[$this->config['env']];
        $token = $this->token($base);
        foreach (self::SYSTEMS as $system => $version) {
            yield from $this->codes("$base/fhir-r4/v1", $token, $system, $version);
        }
    }

    private function token(string $base): string
    {
        try {
            // never put client_secret in a message: only the status code is reported
            $res = Http::asForm()->timeout(30)->post("$base/oauth2/v1/accesstoken?grant_type=client_credentials", [
                'client_id' => $this->config['client_id'],
                'client_secret' => $this->config['client_secret'],
            ]);
        } catch (Throwable $e) {
            throw new RuntimeException('Token SATUSEHAT gagal (koneksi ke '.$base.'). Tidak ada data yang diubah.');
        }
        $token = $res->successful() ? $res->json('access_token') : null;
        if (! is_string($token) || $token === '') {
            throw new RuntimeException("Token SATUSEHAT ditolak (HTTP {$res->status()}). Cek SATUSEHAT_CLIENT_ID/SECRET dan SATUSEHAT_ENV. Tidak ada data yang diubah.");
        }

        return $token;
    }

    /** a) ValueSet/$expand?url=, b) CodeSystem?url= (concept[]). First non-empty answer wins. */
    private function codes(string $fhir, string $token, string $system, string $version): array
    {
        $tried = [];
        foreach (['expand', 'codeSystem'] as $op) {
            try {
                $rows = $this->$op(Http::withToken($token)->acceptJson()->timeout(120), $fhir, $system, $version);
            } catch (RuntimeException $e) {
                $tried[] = $e->getMessage();

                continue;
            }
            if ($rows !== []) {
                return $rows;
            }
            $tried[] = "$op: daftar kosong";
        }
        throw new RuntimeException("API SATUSEHAT tidak memberi daftar $system (".implode('; ', $tried).'). '
            .'Katalog API resmi (per 15 Nov 2026) tidak mendokumentasikan unduhan daftar ICD lengkap lewat API; '
            .'daftar lengkap resmi = spreadsheet terminologi publik: php artisan icd:import --source=satusehat-spreadsheet '
            .'(atau tambahkan --fallback=spreadsheet). Tidak ada data yang diubah.');
    }

    private function expand($http, string $fhir, string $system, string $version): array
    {
        $rows = [];
        do {
            $vs = $this->fhirGet($http, "$fhir/ValueSet/\$expand", ['url' => $system, 'offset' => count($rows), 'count' => self::PAGE], 'ValueSet', 'ValueSet/$expand');
            $page = $this->flatten($vs['expansion']['contains'] ?? [], $vs['version'] ?? null, $version);
            array_push($rows, ...$page);
            $total = $vs['expansion']['total'] ?? null;
        } while (is_int($total) && $page !== [] && count($rows) < $total); // no total = single page

        return $rows;
    }

    private function codeSystem($http, string $fhir, string $system, string $version): array
    {
        $bundle = $this->fhirGet($http, "$fhir/CodeSystem", ['url' => $system], 'Bundle', 'CodeSystem?url=');
        $rows = [];
        foreach ($bundle['entry'] ?? [] as $e) {
            if (($e['resource']['resourceType'] ?? null) === 'CodeSystem') {
                array_push($rows, ...$this->flatten($e['resource']['concept'] ?? [], $e['resource']['version'] ?? null, $version));
            }
        }

        return $rows;
    }

    private function fhirGet($http, string $url, array $query, string $type, string $label): array
    {
        try {
            /** @var Response $res */
            $res = $http->get($url, $query);
        } catch (Throwable) {
            throw new RuntimeException("$label: koneksi gagal");
        }
        $json = $res->json();
        if (! $res->successful() || ($json['resourceType'] ?? null) !== $type) {
            $issue = ($json['resourceType'] ?? null) === 'OperationOutcome' ? ' '.($json['issue'][0]['code'] ?? '') : '';

            throw new RuntimeException("$label: HTTP {$res->status()}$issue");
        }

        return $json;
    }

    /** contains[] / concept[] (possibly nested) -> [code, display, version]; a code without display is an error. */
    private function flatten(array $items, mixed $resourceVersion, string $version): array
    {
        $rows = [];
        foreach ($items as $it) {
            if (isset($it['code'])) {
                $v = $it['version'] ?? $resourceVersion;
                if ($v !== null && ! in_array((string) $v, ['2010', $version], true)) {
                    throw new RuntimeException("Versi '$v' dari API untuk kode {$it['code']} bukan $version; tidak diimpor.");
                }
                $display = trim((string) ($it['display'] ?? ''));
                if ($display === '') {
                    throw new RuntimeException("Kode {$it['code']} dari API tanpa display; tidak diimpor.");
                }
                $rows[] = [(string) $it['code'], $display, $version];
            }
            array_push($rows, ...$this->flatten($it['contains'] ?? $it['concept'] ?? [], $resourceVersion, $version));
        }

        return $rows;
    }
}
