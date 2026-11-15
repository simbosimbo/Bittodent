# Modul IcdSuggestions (A1: saran kode ICD-10 / ICD-9-CM)

Saran kode untuk kunjungan yang masih terbuka. Dokter gigi yang memutuskan: saran = draf (`agent_draft` jenis `saran_icd`,
satu kode per draf, target = kunjungan) sampai disetujui. **Menyetujui hanya menambah kode ke SOAP draf** (ICD-10 → `A.codes`,
ICD-9-CM → `P.codes`) lewat `Clinical\Contracts\VisitCoding`. Tidak pernah menandatangani, tidak membuat versi bertanda tangan,
tidak menyentuh outbox, tidak mengubah S/O/teks. Draf `saran_icd` hanya bisa ditinjau lewat endpoint fitur ini
(`DraftKind::ownFlow()`); `/api/ai-drafts/{id}/approve|reject` menolak dengan `own_flow`.

Sambungan: `IcdSuggestions → Clinical, Agents` (config/modules.php). Tidak ada edge ke Integrations: panggilan model lewat
`Agents\Contracts\AgentCall::prompt()` + `AgentRuns::call()`.

## Mode

- **Gratis (bawaan)**: tanpa LLM, tanpa embedding, tanpa vector DB. Pencarian kamus deterministik. Satu `agent_run`
  deterministik (`koding`, `icd-kamus-v1`, region `id-lokal`) + audit `ai_panggil` per set input baru. Input sama = tidak ada run/draf baru.
- **Berbayar (opsional)**: hanya jika `App\Shared\Ai\ClinicAiSettings::paidAiEnabled()` (baris `clinic_ai_setting` klinik menang;
  tanpa baris = `config('ai.paid_ai.default')` / `AI_PAID_ENABLED`, bawaan `false`). Model `qwen.qwen3-32b-v1:0`
  (`config('ai.icd.model_id')`, harus persis ada di `allowed_model_ids`), suhu 0, versi prompt `icd-koding-v1`. Model hanya
  **memilih** dari ≤40 kandidat `IcdSearch` dan wajib mengutip ref masukan (F1.., A, P), divalidasi `CitationValidator`.
  Kode di luar kandidat / tidak ada di kamus / ref tak dikenal dibuang. Gagal apa pun (model mati, JSON rusak, >50% dibuang,
  model tidak di daftar izin) → **kembali ke urutan deterministik** (tetap 200 dengan draf). Masukan model: teks A/P yang sudah
  disamarkan (`App\Shared\Ai\Pseudonymizer`: nama pasien/dokter, NIK, HP, email, tanggal, no. RM, alamat) + temuan sebagai
  "gigi 36 permukaan O: karies". Tidak ada nama, NIK, UUID, atau no. RM.
  Catatan: model yang benar-benar dipakai masih ditentukan `ModelClient` yang terpasang; `BedrockJakartaModelClient` belum
  tersambung (gerbang D-030), jadi model ID per panggilan disambungkan saat itu.

## Masukan (tanpa identitas pasien)

- `F1..Fn`: temuan odontogram **final** terkini (bukan yang digantikan). Kondisi `karies`, `sisa_akar`, `hilang` → ICD-10;
  status `direncanakan` + `procedure_code` → ICD-9-CM (kode persis).
- `A`: teks A pada SOAP draf → ICD-10. `P`: teks P pada SOAP draf → ICD-9-CM.
- Kode yang sudah ada di SOAP draf tidak disarankan lagi. Kode yang sudah disetujui/ditolak di kunjungan ini tidak muncul lagi.

## Urutan deterministik (`MysqlIcdSearch`, ≤40 kandidat)

1. Kode persis di teks (ICD-10 `K02.1`; ICD-9-CM wajib bertitik `23.09` karena `23`/`36` lebih sering nomor gigi).
2. Sinonim Indonesia: semua kata istilah ada di teks (urutan bebas, huruf besar/kecil dan tanda baca diabaikan).
3. Sinonim dengan satu salah ketik (kata ≥5 huruf, jarak edit 1), mis. "berlobang", "scalling".
4. FULLTEXT pada judul resmi (bahasa Inggris), mis. "chronic periodontitis".

Seri: istilah lebih panjang / lebih banyak kata judul yang cocok, lalu kode lebih spesifik (lebih panjang), lalu urutan kode.
Di tingkat kunjungan: kandidat dari semua ref digabung (skor terbaik, ref digabung), seri berikutnya = jumlah ref; diambil 3 teratas per sistem.

## Kamus

- `icd_entry`, `icd_synonym` **global** (tanpa `tenant_id`). `ehr_app` hanya SELECT; seed/impor lewat `mysql_admin`.
- Isi sekarang = **contoh kecil** (30 ICD-10 K00–K13, 16 ICD-9-CM), disalin apa adanya dari dokumen resmi SATUSEHAT
  (`database/data/icd/SOURCE.md`). Semua baris `perlu_dicek`. Bukan kamus lengkap. Judul resmi tetap bahasa Inggris.
- `synonyms-id.csv` = padanan Indonesia **tidak resmi** untuk pencarian saja (contoh, perlu dicek dokter gigi).
- `php artisan icd:import --path=<csv|folder>` = **stub**: upsert CSV lokal format resmi (`code,display,version`); tanpa unduhan.
  Tanpa `--path` hanya menampilkan petunjuk ke SATUSEHAT.
- Belum ada validasi klinis (D-030): saran ini alat bantu dengan data palsu, bukan keputusan koding.

## Rencana / catatan merge

- PostgreSQL: implementasi `IcdSearch` baru (mis. `tsvector`/trigram) tanpa mengubah pemanggil.
- PR #25 (feat/icd-reference, kamus lengkap 18k): rumpun cabang lain. Saat digabung, pilih satu skema kamus; nama tipe
  (`Icd10`/`Icd9cm`, `ICD10_2010`/`ICD9CM_2010`, display resmi) sudah diselaraskan. `icd:import` di sini tidak menggantikan PR #25.
- PR #59 dan A2 (saran tindakan): perubahan `Agents` (`approve/reject($as)`, `supersede`, `OWN_FLOW`/`WRONG_KIND`) disalin sama
  persis dari A2; saat merge cukup gabungkan `DraftKind::ownFlow()` menjadi `SaranTindakan || SaranIcd`.
- A4 (KTP): tabel `clinic_ai_setting`, kunci `ai.paid_ai.default`, env `AI_PAID_ENABLED` sama. Migrasi A1 membuat tabel hanya
  jika belum ada (`hasTable`); migrasi A4 tidak memakai guard, jadi pada DB dev yang sudah menjalankan A1 lebih dulu, migrasi A4
  perlu dilewati/di-fresh. Setelah merge: pakai satu model (`Shared\Ai\ClinicAiSetting` atau `Ktp\Models\ClinicAiSetting`), kalau
  tidak `ArchitectureTest` (satu model per tabel tenant) gagal, dan pindahkan A4 ke kontrak `App\Shared\Ai\ClinicAiSettings`.

## Golden set

`tests/ai/golden/icd/cases.json` (23 kasus sintetis, termasuk jebakan: salah ketik, istilah daerah, diagnosis kosong,
"gigi berlubang", "cabut", catatan sudah berkode). `IcdGoldenSetTest` mencetak top-1/top-3 dan gagal bila top-3 < 0,80.
Sinonim contoh disusun bersamaan dengan kasus ini, jadi angkanya optimistis; perlu kasus dari dokter gigi sebelum diklaim.
