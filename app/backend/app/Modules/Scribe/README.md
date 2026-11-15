# Scribe (A3) — alat bantu input dokter

Dikte dokter → transkrip → draf SOAP. Keputusan **D-048** (diterima 15 Nov 2026 23:26–23:27 WIB, keputusan langsung Yohanes): scribe adalah **alat bantu input dokter**, bukan rekaman konsultasi. Tidak ada persetujuan pasien dan **tidak ada pemberitahuan ke pasien** (di layar maupun diucapkan).

## Aturan yang mengikat

- Setiap panggilan model lewat `AgentRuns::call` (diaudit). Tes memakai `FakeModelClient`; **jangan** memanggil Bedrock sungguhan.
- ID model harus persis ada di `config/ai.php` `allowed_model_ids`. Region hanya `ap-southeast-3` atau `id-lokal`.
- Keluaran masuk `AgentDrafts` (satu baris = satu item S/O/A/P, `DraftKind::Soap`). Setujui/tolak lewat `ai_draft.review` (dokter saja).
- `tenant_id` selalu difilter. Hanya dokter yang merawat kunjungan itu yang boleh merekam atau meninjau.
- Teks ke LLM disamarkan dulu (`App\Shared\Ai\Pseudonymizer`). Tidak ada PHI (transkrip, audio, NIK, nama) di log.
- Fitur **berbayar**: `AI_PAID_ENABLED` (`config('ai.paid_ai.default')`) **dan** `clinic_ai_setting.paid_enabled` harus nyala. Keduanya mati secara default. Plus batas token bulanan per klinik (`config('ai.paid_ai.monthly_token_cap')`, bisa di-override kolom `clinic_ai_setting.monthly_token_cap`).
- Jika saklar mati: `GET` status tetap 200 dengan `paid_enabled: false` + `disabled: true`; unggah/proses/setujui/tolak = **403**.
- Draf **tidak pernah** menulis atau menimpa `clinical_note_version` (D-001, D-017). Setujui hanya menandai item dan mengembalikan teks; dokter yang menempelkannya ke formulir SOAP, lalu Simpan draf / Selesai seperti biasa.
- Audio mentah dienkripsi, lalu **dihapus segera** setelah transkrip + draf SOAP dibuat, atau paling lambat 24 jam jika gagal; penghapusan diaudit (D-048, memperketat D-038). Tidak ada putar ulang audio.
- Sitasi: setiap butir SOAP wajib mengutip segmen transkrip `T1..Tn`. `CitationValidator` membuang klaim tanpa sitasi valid. Jenis sumber yang diizinkan: `transcript`.
- AI hanya merapikan yang diucapkan; dilarang menambah diagnosis, obat, atau kode yang tidak diucapkan (D-037 butir 3).
- UI: jangan tampilkan pemberitahuan ke pasien. Tombol rekam dan berhenti ≥ 48 px. Tolak memakai pola commit tertunda 5 detik + **Urungkan** (lihat IcdSuggestions `pendingReject.ts` di PR #60; salin polanya, jangan tergantung modul ICD).
- Data sintetis saja.

## Model

- **SOAP (teks):** `qwen.qwen3-32b-v1:0` (`config('ai.scribe.soap_model_id')`), Bedrock Jakarta in-region. Ringan dan sudah di daftar izin. Cadangan dokumen: `qwen.qwen3-235b-a22b-2507-v1:0`.
- **Suara→teks:** **tidak ada model in-region di `ap-southeast-3`.** Dicek 15 Nov 2026:
  - [Regional availability by models](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html): tabel Voxtral Small 24B 2507 dan Voxtral Mini 3B 2507 **tidak memuat** `ap-southeast-3` (Jakarta). Wilayah in-region yang tercantum: us-east-1/2, us-west-2, eu-south-1, eu-west-1/2, ap-northeast-1, ap-south-1, ap-southeast-2, sa-east-1.
  - [Kartu Voxtral Mini](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-mistral-ai-voxtral-mini-3b-2507.html) / [Small](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-mistral-ai-voxtral-small-24b-2507.html) mencantumkan baris Jakarta, tetapi halaman per region (sumber yang lebih rinci) tidak. Voxtral juga Legacy, EOL 30 Mar 2027, Bahasa Indonesia tidak resmi.
  - Amazon Transcribe **tidak** punya endpoint Jakarta ([endpoint](https://docs.aws.amazon.com/general/latest/gr/transcribe.html)).
  - **Jangan** memakai Voxtral atau Transcribe di region lain (D-009). **Jangan** menambah ID Voxtral ke `allowed_model_ids`.
- **Pengganti in-region yang diusulkan (bukan dijalankan di PR ini):** transkripsi **di perangkat** (mis. Whisper WASM di browser), sehingga audio tidak keluar dari perangkat dokter; hanya transkrip yang sudah disamarkan dikirim ke Bedrock Jakarta (`qwen.qwen3-32b-v1:0`) untuk draf SOAP. Cadangan nanti bila ada anggaran GPU: Whisper self-host di VPS Jakarta, atau Prosa.ai on-premise setelah kontrak/DPIA. Produksi: `SpeechToText` = `NotConfiguredSpeechToText` (`not_configured`). Tes: `FakeSpeechToText`.

## Antarmuka HTTP

Semua di belakang `auth:sanctum`, `2fa`, `tenant`. Mutasi: dokter + `note.write` + `ai_draft.review`, dan `dentist_id` kunjungan = user.

- `GET /api/visits/{id}/scribe` — status, `paid_enabled`, sisa token, sesi terakhir, item draf. 200 meski mati. 404 lintas tenant.
- `POST /api/visits/{id}/scribe` — `multipart/form-data` field `audio` + `duration_sec`. Batas: 25 MB, 15 menit, MIME `audio/webm|wav|mpeg|ogg|mp4`. 403 jika saklar mati atau bukan dokter merawat, 429 jika batas token habis, 422 jika file/durasi dilanggar, 503 jika STT `not_configured`.
- `POST /api/scribe/sessions/{id}/process` — ulang proses (sesi gagal yang audio-nya masih ada).
- `POST /api/scribe/drafts/{id}/approve` — body opsional `{ "text": "..." }` untuk suntingan di UI; **tidak** menulis catatan klinis.
- `POST /api/scribe/drafts/{id}/reject` — `{ "reason": "..." }`.

## Tes wajib

Saklar mati → 403 pada unggah; GET menampilkan disabled. Lintas tenant → 404. Audio hilang setelah proses sukses (ciphertext tidak ada, audit penghapusan ada). Setujui tidak menambah/menimpa `clinical_note_version`. Klaim tanpa sitasi dibuang. Batas token bulanan → 429. Semua `php artisan test`, `npm test`, `tsc`, dan build hijau. Data sintetis.
