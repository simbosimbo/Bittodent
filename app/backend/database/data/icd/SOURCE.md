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

API FHIR SATUSEHAT (sandbox/production) membutuhkan OAuth2 client_credentials (client_id + client_secret) dan TIDAK diperlukan untuk impor dokumen terminologi publik ini.

API SATUSEHAT FHIR bukan sumber unduhan daftar kode. Implementasi Guide menyatakan akses ICD lewat "website pihak ketiga" dan menautkan dokumen di atas.
