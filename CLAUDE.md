# CLAUDE.md — Brief Proyek EHR Gigi Agentic

**Apa ini:** sistem rekam medis & manajemen klinik gigi berbasis cloud untuk Indonesia. Agen AI mengerjakan admin; dokter gigi tetap pemegang keputusan klinis. Status: dokumen + prototipe Laravel di `app/` (`backend/` Laravel API, `frontend/` React SPA; data palsu saja; penyimpangan dicatat di `app/DEVIATIONS.md`). Prototipe Node lama diarsipkan di `archive-node/` (jangan diubah).

**Baca dulu:** `docs/product.md`, `docs/agents.md`, `docs/compliance.md`, `docs/architecture.md`, `docs/database.md`, `docs/decisions.md`, `docs/user-stories.md`.

## Urutan prioritas (jika bertentangan)
1. Keamanan & privasi  2. Keselamatan klinis & keutuhan data  3. Regulasi  4. Produk/UX/agen

## Aturan keras
- Keluaran klinis agen = **draf** sampai dokter gigi menyetujui & menandatangani. Jangan buat jalur yang melewati ini.
- Setiap query wajib terfilter `tenant_id`; tidak ada akses lintas klinik.
- Catatan klinis tidak pernah dihapus/ditimpa; koreksi = versi baru + jejak audit.
- Data kesehatan & NIK dienkripsi per-kolom. Jangan log isi data sensitif.
  - **Pengecualian terdokumentasi (D-020, diterima Jerome):** nama pasien, tanggal lahir, dan kode terstruktur (ICD-10, ICD-9-CM, kode gigi, KFA) disimpan tanpa enkripsi per kolom agar bisa dicari sebagian (indeks trigram) dan dilaporkan. NIK, HP, alamat, dan teks klinis bebas **tetap** dienkripsi (NIK/HP dengan blind index). Butir DPIA; jangan memperluas pengecualian ini tanpa keputusan baru.
- **Tidak ada data pasien asli** di kode, tes, seed, fixture, atau log. Pakai data sintetis.
- Data & backup tetap di Indonesia.
- Jangan mengarang regulasi, nomor pasal, kode, atau fakta pesaing. Kalau tidak yakin, tulis "perlu dicek".
- Jangan klaim sertifikasi/kepatuhan (ISO, SATUSEHAT, BPJS) di UI, dokumen, atau pesan.

## Cakupan & keputusan kunci
- Target: praktik mandiri, klinik 2–5 kursi, dan multi-cabang. Model data `tenant → cabang → kursi`; setiap data operasional terikat ke cabang. **Mode sederhana** = UI ringkas di atas struktur yang sama (D-007).
- MVP: pasien umum + asuransi swasta. **BPJS belum dibuat**, tapi model penjamin harus siap BPJS (jenis penjamin, no. & kelas kepesertaan, ICD per kunjungan, status klaim) (D-008).
- AI (**D-009, diterima**): semua pemrosesan AI di Indonesia; model top global tidak boleh menyentuh data klinis. LLM via Amazon Bedrock Jakarta `ap-southeast-3` model in-region saja; **jangan pakai inferensi Geo/Global**. Suara→teks belum dipilih (uji: model di-host sendiri di Jakarta vs Prosa.ai). Jangan hardcode penyedia; buat lapisan adaptor.
- Hosting (D-010, diterima): Hostinger hanya untuk prototipe/demo dengan data palsu sampai diputuskan. Jangan bergantung pada fitur khusus Hostinger (aplikasi harus bisa pindah: Docker, PostgreSQL standar, konfigurasi lewat variabel lingkungan).
- Recall WhatsApp masuk MVP (D-011): hanya pasien yang memberi izin, template disetujui pemilik, tanpa isi klinis di pesan.
- Tanda tangan persetujuan (D-012): tanda tangan sederhana di tablet + catat waktu, penanda tangan, saksi, perangkat, hash dokumen. Simpan bukti tanda tangan terpisah agar bisa naik ke TTE tersertifikasi (Q-5, perlu dicek). Daftar tindakan invasif ditetapkan dokter gigi berizin, bukan kita.
- Koreksi >2x24 jam di praktik mandiri (D-013): dokter menyetujui sendiri, alasan wajib, versi asli tetap, audit lengkap. Dasar hukum perlu dicek.

## Blueprint teknis (D-029 diterima; D-015–D-028 tetap berlaku)
- Stack (D-029): **Laravel 13 API saja** (PHP 8.4, `FormRequest` di pintu masuk, **tanpa Inertia, tanpa Blade**) + **React SPA (Vite) terpisah** + **MySQL 8.4 LTS untuk MVP, DATA PALSU SAJA (D-030)**; target **PostgreSQL 18 + RLS** wajib sebelum data pasien asli (gerbang keras). Login: Sanctum (cookie sesi SPA) + Fortify TOTP **wajib untuk semua peran** (ditegakkan middleware; "remember me" mati). Antrean Laravel driver `database` + tabel `outbox`. S3-compatible terenkripsi aplikasi (bukan MinIO), Docker Compose. Situs publik terpisah (statis/SSR). Tidak dipakai lagi: Node/Fastify/Zod/Drizzle/pg-boss/Better Auth.
- MVP MySQL (database.md 11): `tenant_id` di setiap tabel tenant, trait `BelongsToTenant` (global scope wajib, gagal tertutup) di setiap model tenant, FK gabungan `(tenant_id, id)`, user `ehr_app` tanpa `DROP`/`TRUNCATE`/`ALTER`, trigger `BEFORE UPDATE/DELETE` untuk catatan bertanda tangan/odontogram final/audit, dilarang `withoutGlobalScope`/`DB::table` pada tabel tenant (tes arsitektur). Kode aplikasi tanpa SQL khusus MySQL; SQL khusus MySQL hanya di `backend/database/migrations/mysql/`.
- Bagian di bawah tentang RLS/`set_config` = desain **target PostgreSQL**.
- Database: lihat `docs/database.md`. `tenant_id` pertama di setiap indeks dan di setiap FK. RLS `FORCE`, peran non-pemilik, pemilik tabel bukan superuser, view `security_invoker`, `set_config('app.tenant_id', $1, true)` per transaksi (bukan `SET LOCAL` gabung string). Indeks trigram **tidak terpakai** di bawah RLS: cari nama lewat fungsi `search_patient` (database.md 7.2). Peran aplikasi tanpa `DELETE`/`TRUNCATE`. Konteks tenant hanya dipasang di middleware tenant Laravel (transaksi per request, `set_config(..., true)` dengan parameter `?`); dilarang `set_config(..., false)` / `SET` tanpa `LOCAL` (bocor antar-request di Octane/PgBouncer). Job antrean membuka transaksi tenant sendiri. Koneksi `pgsql_admin` hanya untuk migrasi/seed/tes. Enkripsi kolom memakai kunci terpisah dari `APP_KEY`.
- Catatan klinis & odontogram: versi **bertanda tangan** hanya ditambah; tidak ada UPDATE/DELETE. Draf boleh diubah sampai ditandatangani. "Digantikan" diturunkan dari `supersedes_id`, bukan mengubah baris final. Status lewat fungsi transisi state machine, bukan boolean.
- Semua kiriman keluar (SATUSEHAT, WhatsApp) lewat tabel `outbox` dengan kunci idempotensi + `lease_token` sebagai pagar saat menulis hasil (pengirimnya job antrean Laravel). Setiap pekerjaan harus aman dijalankan dua kali.
- Dokter boleh melihat riwayat klinis lintas cabang dalam satu tenant (D-027); setiap tampilan lintas cabang wajib tercatat di audit.
- Mode offline (D-026, D-028): PIN 6 angka + KDF kuat + hapus setelah 5 salah, data maks 12 jam, hanya data hari ini per cabang, IndexedDB terenkripsi, service worker **tidak boleh** menyimpan respons `/api`. Tidak ada tanda tangan klinis, AI, atau SATUSEHAT saat offline.
- Kecepatan: target p95 di `docs/database.md` 7.2 adalah target. Buktikan dengan seed sintetis + `EXPLAIN (ANALYZE, BUFFERS)` dengan RLS aktif sebelum mengklaim.

## Standar yang dipakai
SATUSEHAT (HL7 FHIR R4, use case Gigi), KFA untuk obat, ICD-10 diagnosis, ICD-9-CM (versi 2010) tindakan. Retensi ≥25 tahun. Edit bebas catatan 2x24 jam (Pasal 30 ayat 6). Jalur persetujuan setelah 2x24 jam (ayat 7) tertulis untuk data **administratif**; untuk data klinis perlu dicek hukum.

## Gaya
Dokumen & UI dalam bahasa Indonesia yang sederhana. Acuan visual: Zendenta (inspirasi saja, jangan menyalin).

## Hemat token
Pakai `rtk` (sudah terpasang, /home/box/.local/bin/rtk) untuk output perintah: `rtk test <cmd>` (hanya yang gagal), `rtk git ...`, `rtk diff`, `rtk err <cmd>`, `rtk rg ...`, `rtk read <file>`, `rtk log`.
