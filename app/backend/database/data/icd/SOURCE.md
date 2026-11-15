# Sumber data ICD resmi (diverifikasi 15 Nov 2026, Asia/Jakarta)

SATUSEHAT Platform memakai ICD-10 versi 2010 (diagnosis) dan ICD-9-CM versi 2010 (tindakan).
Dokumentasi resmi:
- https://satusehat.kemkes.go.id/platform/docs/id/terminology/
- https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-10/
- https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-9-cm/

Dokumen terminologi dipublikasikan sebagai spreadsheet Google dengan tombol "Unduh" (tanpa login) dan juga lewat https://s.kemkes.go.id/databaseICD.

| Berkas | URL resmi | Nama unduhan | Kode valid | Versi | SHA-256 (unduh 15 Nov 2026) |
| --- | --- | --- | --- | --- | --- |
| PUBLIC-ICD-10-e-klaim.xlsx | https://docs.google.com/spreadsheets/d/12_72PvHRLWny3VEwodEI6TRDc7QqWdiF/export?format=xlsx | [PUBLIC] ICD-10 e-klaim.xlsx | 18542 (998 baris kosong dilewati) | ICD10_2010 | 306c8860feb562014de48e894e9254b08aa492770cd04ea29de6707d7e51e150 |
| PUBLIC-ICD-9CM.xlsx | https://docs.google.com/spreadsheets/d/1uw9aEzM61rsp7PVt7dRHt2eATg64qQB_/export?format=xlsx | spreadsheet ICD-9 CM | 4626 | ICD9CM_2010 | af94244dffa652ba11be26b9843c04989e3bfaaead9d5be5bc0e7ca7fd2c99c5 |

Kolom resmi: CODE, DISPLAY, VERSION. DISPLAY berbahasa Inggris. Tidak ada judul bahasa Indonesia di dokumen resmi — jangan mengarang terjemahan.

CSV di folder ini diekspor apa adanya dari xlsx resmi (baris kosong dibuang, tidak ada kode/deskripsi yang diubah):
- icd10_codes.csv SHA-256 0493fd7e38e3c041c252d224a5390135abd5b40ee1d4f503e4249868eb2fdac4
- icd9cm_codes.csv SHA-256 ea2afa8b09aa6fcafd50a79b1a12855f27d0f7490982bd37a9f47f761b9a987e

Fakta yang dicek ke dokumen resmi:
- K02.5 (Caries with pulp exposure, WHO 2019) TIDAK ada di ICD10_2010 SATUSEHAT.
- K02.1 = Caries of dentine; K02.0 = Caries limited to enamel; K08.3 = Retained dental root; K01.1 = Impacted teeth.
- 23.01 = Extraction of deciduous tooth; 23.09 = Extraction of other tooth; 23.19 = Other surgical extraction of tooth; 23.11 = Removal of residual root; 96.54 = Dental scaling, polishing, and debridement.

## API FHIR SATUSEHAT (`--source=satusehat`, dicek 15 Nov 2026)

- Token (resmi, https://satusehat.kemkes.go.id/platform/docs/id/api-catalogue/authentication/apis/token/):
  `POST {base}/oauth2/v1/accesstoken?grant_type=client_credentials`, `Content-Type: application/x-www-form-urlencoded`,
  body `client_id`, `client_secret`; lalu `Authorization: Bearer <access_token>`.
- Base sandbox `https://api-satusehat-stg.dto.kemkes.go.id`, production `https://api-satusehat.kemkes.go.id`; FHIR `{base}/fhir-r4/v1`.
- Katalog API resmi mencantumkan resource klinis (Condition, Procedure, ...), **tidak** mencantumkan CodeSystem/ValueSet,
  dan **tidak** mendokumentasikan `$expand`/`$lookup` sebagai cara mengunduh daftar ICD lengkap. Validasi kode ICD terjadi saat
  fasyankes mengirim resource (https://satusehat.kemkes.go.id/platform/docs/id/api-catalogue/validasi/). IG FHIR: akses ICD lewat
  website pihak ketiga (system `http://hl7.org/fhir/sid/icd-10`, `http://hl7.org/fhir/sid/icd-9-cm`).
- Probe tanpa token (15 Nov 2026) ke metadata, ValueSet, CodeSystem, ValueSet/$expand: HTTP 401 "Invalid Access Token".
  Itu hanya membuktikan gateway ada, **bukan** bahwa path itu memberi daftar ICD.
- Adaptor `SatusehatApiSource` mencoba, per system: (a) `GET ValueSet/$expand?url={system}` (paging `offset`/`count` bila ada
  `expansion.total`), lalu (b) `GET CodeSystem?url={system}` (`concept[]`). Hanya `code` + `display` dibaca. Bila resource tanpa
  `version`, dipakai versi yang didokumentasikan SATUSEHAT: `ICD10_2010` / `ICD9CM_2010` (versi lain ditolak).
- Bila token gagal atau kedua operasi gagal/kosong (401/403/404/OperationOutcome): perintah gagal, **tidak ada yang ditulis**.
  Fallback ke spreadsheet hanya bila operator menulis `--fallback=spreadsheet`.

**Daftar lengkap resmi yang terdokumentasi tetap spreadsheet publik di atas** (`--source=satusehat-spreadsheet`).

Kredensial sandbox (https://satusehat.kemkes.go.id/platform/docs/id/api-code/access-sandbox/, pendaftaran
https://satusehat.kemkes.go.id/platform/docs/id/registration-guide/registration/): daftar di https://satusehat.kemkes.go.id/platform,
aktifkan email, login, ganti environment ke **Sandbox**, buka menu **Kode Akses API**, salin Organization ID, Client ID, Client Secret
ke `.env` (bukan ke repo): `SATUSEHAT_ENV=sandbox`, `SATUSEHAT_CLIENT_ID`, `SATUSEHAT_CLIENT_SECRET`, `SATUSEHAT_ORG_ID`.
