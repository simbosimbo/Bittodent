# Log Keputusan (draf 7)

## Format
Setiap keputusan ditulis dengan pola ini (mirip *ADR* = Architecture Decision Record, catatan singkat kenapa sebuah pilihan diambil):

```
### D-XXX: Judul singkat
- Tanggal: YYYY-MM-DD
- Status: Usulan | Diterima | Diganti oleh D-YYY | Ditolak
- Konteks: masalahnya apa
- Keputusan: apa yang dipilih
- Alasan: kenapa (sebut sumber regulasi jika ada)
- Akibat: apa yang jadi lebih mudah/sulit
```

## Keputusan

### D-001: Semua keluaran klinis agen berstatus draf
- Tanggal: 2026-11-14 · Status: **Diterima** (aturan profil agen)
- Keputusan: catatan, odontogram, kode, resep dari agen hanya draf sampai dokter gigi berizin menyetujui dan menandatangani.
- Alasan: keselamatan klinis; Permenkes 24/2022 Pasal 16 ayat 2 dan UU 17/2023 Pasal 296 ayat 4 (nama, waktu, tanda tangan nakes).
- Akibat: perlu antrean persetujuan yang cepat agar dokter tidak terbebani.

### D-002: Data disimpan di Indonesia
- Tanggal: 2026-11-14 · Status: **Usulan** (diperkuat D-009 untuk pemrosesan AI)
- Keputusan: produksi dan backup di wilayah Indonesia.
- Alasan: Permenkes 24/2022 Pasal 22 (penyimpanan PSE di dalam negeri), UU PDP Pasal 56.
- Akibat: pilihan region cloud terbatas; penyedia AI di luar negeri butuh penilaian khusus.

### D-003: Multi-tenant dengan isolasi di level database
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: satu aplikasi, `tenant_id` + row-level security + kunci enkripsi per tenant.
- Alasan: biaya lebih rendah dari satu server per klinik, isolasi tetap kuat.
- Akibat: tes isolasi wajib di setiap rilis.

### D-004: Sinkron SATUSEHAT masuk MVP
- Tanggal: 2026-11-14 · Status: **Usulan**
- Alasan: Permenkes 24/2022 Pasal 21 mewajibkan RME terhubung dengan platform Kemenkes.
- Akibat: onboarding SATUSEHAT jadi jalur kritis peluncuran.

### D-005: Retensi minimal 25 tahun, tanpa hapus otomatis
- Tanggal: 2026-11-14 · Status: **Usulan**
- Alasan: Permenkes 24/2022 Pasal 39. Catatan: cek apakah PP 28/2024 mengubahnya.

### D-006: Zendenta sebagai acuan UI/UX (inspirasi saja)
- Tanggal: 2026-11-14 · Status: **Diterima** (pilihan Jerome)
- Konteks: butuh arah visual & alur yang sederhana untuk klinik yang masih manual.
- Keputusan: pakai [Zendenta oleh Fikri Studio](https://fikristudio.com/project/zendenta) sebagai referensi: gaya bersih, palet medis segar, jadwal cepat + waitlist, pemeriksaan 4 langkah (info, rencana perawatan, hasil periksa mulut, persetujuan), daftar pasien, jadwal staf, inventaris, modul penjualan dengan "kantong" uang.
- Batasan: karya klien perusahaan lain → **inspirasi saja, tidak menyalin** desain, aset, ikon, atau teks.
- Tambahan wajib di luar Zendenta: odontogram standar Indonesia, BPJS (jika di cakupan), sinkron SATUSEHAT, langkah persetujuan dokter untuk draf agen.

### D-007: Melayani semua ukuran klinik — tenant dengan banyak cabang + mode sederhana
- Tanggal: 2026-11-14 · Status: **Diterima** (jawaban Jerome atas Q-1)
- Konteks: target pasar = praktik mandiri 1–2 kursi, klinik 2–5 kursi, dan jaringan multi-cabang.
- Keputusan: satu model data `tenant → cabang → kursi`. Setiap tenant punya minimal satu cabang. Data klinis, jadwal, kasir, dan hak akses selalu terikat ke cabang. **Mode sederhana** untuk praktik mandiri: satu cabang, menu ringkas, satu orang boleh memegang beberapa peran (misal dokter + pemilik), tapi tanda tangan klinis tetap hanya oleh dokter.
- Alasan: menghindari dua sistem terpisah; klinik bisa tumbuh tanpa migrasi data.
- Akibat: struktur multi-cabang masuk MVP; RBAC harus mendukung peran per cabang; uji isolasi mencakup antar-tenant **dan** antar-cabang sesuai izin.

### D-008: BPJS tidak masuk MVP, tapi model data siap BPJS
- Tanggal: 2026-11-14 · Status: **Diterima** (jawaban Jerome atas Q-2)
- Keputusan: MVP melayani pasien umum + asuransi swasta. Model data sejak awal menyiapkan: jenis penjamin (umum/asuransi swasta/BPJS), nomor kepesertaan, kelas kepesertaan (mengacu terminologi `coverage-class` di lampiran "Klaim BPJS Kesehatan" SATUSEHAT), kode diagnosis ICD-10 & tindakan ICD-9-CM per kunjungan, status klaim, dan referensi ID eksternal per penjamin.
- Alasan: bridging BPJS (PCare/Antrean) butuh proses akses dan aturan manfaat yang belum terverifikasi; menundanya memperpendek jalan ke MVP.
- Akibat: klinik yang wajib melayani BPJS belum bisa memakai sistem penuh di versi awal; tambahkan BPJS sebagai modul tanpa ubah struktur data.

### D-009: Lokasi pemrosesan AI suara→teks dan LLM — hanya di Indonesia
- Tanggal: 2026-11-14 · Status: **Diterima** oleh Jerome (14 Nov 2026). Tinjauan hukum tetap dijadwalkan (menjawab Q-3, Q-8)
- Konteks: scribe suara dan agen memproses data kesehatan (data pribadi spesifik, UU PDP Pasal 4). Permenkes 24/2022 Pasal 20–22 mengatur penyimpanan (cloud tersertifikasi; PSE penyimpan wajib di dalam negeri). UU PDP Pasal 56 membatasi transfer ke luar negeri. Detail opsi & bukti: architecture.md bagian "Lokasi pemrosesan AI".
- Keputusan:
  1. **Semua pemrosesan AI berjalan di Indonesia (Jakarta) secara default.** Tidak ada audio atau teks klinis yang dikirim ke luar negeri.
  2. **LLM**: Amazon Bedrock region Jakarta (`ap-southeast-3`) **hanya dengan inferensi in-region** (model yang tercantum "In-Region" untuk Jakarta, misal Qwen3, DeepSeek, gpt-oss, Amazon Nova). Inferensi lintas-region "Geo" dan "Global" **dilarang** lewat kebijakan akses.
  3. **Suara→teks**: tidak ada layanan suara terkelola di Jakarta dari Google/AWS/Azure (lihat bukti). Jadi: **uji banding** dua jalur dalam negeri — (a) model suara open-source di-host sendiri di GPU Jakarta, (b) vendor lokal Prosa.ai dengan deployment on-premise/dalam negeri — pakai rekaman diktasi gigi **sintetis**; pilih yang akurasinya lebih baik untuk istilah gigi.
  4. Sampai uji selesai, scribe suara jalan sebagai fitur **beta** dengan persetujuan pasien eksplisit untuk perekaman. *Diusulkan untuk digantikan oleh D-048 (menunggu konfirmasi).*
- Alasan: privasi di urutan pertama; menghindari pertanyaan hukum transfer lintas negara; Bedrock menyatakan penyedia model tidak punya akses ke prompt/keluaran.
- Akibat: model frontier terbaik (yang di Jakarta hanya tersedia via inferensi Global) tidak dipakai; kualitas Bahasa Indonesia istilah gigi harus dibuktikan dengan uji; hosting model suara sendiri menambah kerja operasional.
- Ditegaskan Jerome: **tidak ada routing Geo/Global**, dan **model top global tidak dipakai untuk data klinis**.
- Pengecualian (jika uji kualitas suara gagal): pemrosesan di Singapura hanya setelah DPIA, penilaian Pasal 56, kontrak, pendapat hukum tertulis, **dan persetujuan baru dari Jerome** — bukan default.

### D-010 (DITERIMA 2026-11-14): Hostinger hanya untuk prototipe/demo dengan data palsu; cloud produksi diputuskan nanti
- Tanggal: 2026-11-14 · Status: **Diterima** (Q-10 ditutup; penilaian lengkap di architecture.md bagian 10)
- Konteks: Jerome menyebut paket **Hostinger Cloud Startup**. AI tetap di AWS Jakarta (D-009), jadi alurnya hibrida: Hostinger (Indonesia) → AWS Jakarta.
- Temuan singkat:
  - Cloud Startup adalah **hosting cloud terkelola** (bukan VPS): Node.js + MySQL terkelola, panel hPanel, **tanpa root dan tanpa Docker** (root & Docker hanya di VPS). Python, PostgreSQL bawaan, dan background jobs: tidak disebut (perlu dicek).
  - Ada lokasi data center **Indonesia** dan lokasi bisa dipilih/dipindah gratis; kota persisnya untuk paket Cloud: perlu dicek. VPS Hostinger tersedia di **Jakarta**.
  - Ketentuan Hostinger: layanan **tidak dimaksudkan sebagai lingkungan PCI/HIPAA**; backup bawaan mingguan, hanya 2 minggu, di "remote server" yang lokasinya tidak disebut; pelanggan wajib membuat backup sendiri. SLA 99,9% dengan kompensasi kredit 5%.
  - DPA ada: Hostinger mengenkripsi data pribadi saat disimpan (sebagai langkah internal), memberi tahu insiden "tanpa penundaan yang tidak semestinya" (tanpa batas jam), dan menyerahkan tanggung jawab data sensitif (termasuk data kesehatan) ke pelanggan. Kebijakan keamanan menyebut ISO/IEC 27001:2022 sebagai acuan, **tapi sertifikatnya tidak ditemukan** (perlu dicek).
- Usulan:
  1. **Cocok untuk prototipe/demo dengan data palsu** (Cloud Startup atau VPS Jakarta).
  2. **Belum cocok untuk produksi dengan data pasien asli** sampai terbukti: sertifikasi cloud/ISO 27001 untuk data center Indonesia, lokasi backup di Indonesia, rekomendasi Kemenkes bila Hostinger dianggap PSE penyimpan (Permenkes 24/2022 Pasal 22), dan kontrak yang menerima data kesehatan.
  3. Jika tetap Hostinger untuk produksi: pakai **VPS Jakarta** (root, Docker, PostgreSQL sendiri), bukan Cloud Startup; plus backup terenkripsi kedua di lokasi Indonesia lain yang kita kendalikan.
- Alternatif yang perlu dibandingkan untuk produksi: menaruh aplikasi juga di **AWS Jakarta** (satu penyedia dengan AI, tanpa data keluar penyedia). Bukti sertifikasi AWS untuk region Jakarta belum dicek (perlu dicek).

### D-011: Recall lewat WhatsApp masuk MVP
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome; menutup Q-11)
- Konteks: product.md menaruh recall otomatis di fase 2, padahal daftar modul MVP menyebutnya.
- Keputusan: recall kontrol rutin lewat WhatsApp masuk MVP. Cerita RCL-1 dan RCL-2 naik ke Wajib (RCL-3 berhenti-berlangganan sudah Wajib; laporan recall RCL-4 tetap Nanti).
- Aturan: hanya untuk pasien yang memberi izin WhatsApp (UU PDP Pasal 20), memakai template yang disetujui pemilik, tanpa isi klinis dalam pesan. Aturan template WhatsApp Business: perlu dicek.
- Akibat: integrasi WhatsApp Business dan agen recall harus siap di MVP.

### D-012: Tanda tangan persetujuan pasien: tanda tangan sederhana di tablet dulu
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome; menutup Q-12 bagian tanda tangan)
- Keputusan: persetujuan tindakan cukup ditandatangani pasien/wali di tablet. Setiap tanda tangan dicatat dengan: waktu, nama penanda tangan (dan saksi), perangkat yang dipakai, dan sidik digital (hash) dokumen yang ditandatangani. Dokumen dikunci; perubahan isi membuat sidik tidak cocok dan butuh persetujuan baru.
- Perlu dicek: tanda tangan elektronik tersertifikasi (Permenkes 24/2022 Pasal 31, Q-5) mungkin diperlukan nanti.
- Akibat desain: bukti tanda tangan disimpan sebagai catatan terpisah yang menunjuk ke dokumen, sehingga nanti bisa ditambah TTE tersertifikasi tanpa mengubah alur persetujuan. RPC-4 naik ke Wajib.
- Masih terbuka: **daftar tindakan gigi invasif/berisiko tinggi** yang wajib persetujuan tertulis (UU 17/2023 Pasal 293) harus ditetapkan oleh **dokter gigi berizin yang meninjau**, bukan oleh tim produk. Sistem hanya menyediakan pengaturan daftarnya.

### D-013: Koreksi setelah 2x24 jam di praktik mandiri
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome; menutup Q-13)
- Konteks: Permenkes 24/2022 Pasal 30 meminta persetujuan untuk perubahan setelah 2x24 jam; di praktik mandiri tidak ada petugas rekam medis atau pimpinan lain.
- Keputusan: di mode sederhana, koreksi setelah 2x24 jam disetujui oleh dokter itu sendiri dengan **alasan wajib dicatat**. Versi asli tetap tersimpan, tidak ada hapus, dan jejak audit mencatat siapa, kapan, apa yang berubah, dan alasannya. Klinik dengan lebih dari satu peran tetap memakai persetujuan penanggung jawab rekam medis/pimpinan.
- Perlu dicek: dasar hukumnya (Pasal 30 ayat 7 menyebut data administratif; aturan untuk data klinis dan untuk praktik mandiri belum jelas).

### D-014: Tech stack TypeScript + PostgreSQL 18
- Tanggal: 2026-11-14 · Status: **Digantikan sebagian oleh D-029** (bagian server: Node.js/Fastify/Zod/Drizzle/pg-boss/Better Auth tidak dipakai lagi; React SPA, PostgreSQL 18, S3-compatible, Docker Compose + Caddy, pgBackRest tetap berlaku)
- Konteks: Jerome tidak membaca kode; kode ditulis Claude Code. Butuh alat yang populer, terdokumentasi, dan mudah pindah server (D-010).
- Keputusan: React SPA (Vite) untuk aplikasi staf, Node.js 26 LTS + Fastify untuk API dan worker, Zod di semua pintu masuk data, PostgreSQL 18 + Drizzle ORM (migrasi SQL), pg-boss untuk pekerjaan terjadwal, Better Auth + TOTP untuk login, penyimpanan file S3-compatible dengan enkripsi aplikasi, Docker Compose + Caddy, pgBackRest untuk backup. Rincian: architecture.md bagian 11.
- Alasan: satu bahasa di semua lapisan; tipe data membantu mencegah salah sambung data; tidak ada server tambahan (Redis/antrean) selain PostgreSQL.
- Alternatif: Laravel + Inertia (cara kerja yang sama dengan HRIS Alesco), Next.js full-stack.
- Akibat: tim harus disiplin memakai satu pintu akses database (`packages/db`). *(Bagian server digantikan D-029: pintu tunggalnya sekarang middleware tenant Laravel.)*

### D-015: Aplikasi staf = SPA; SSR/statis hanya untuk halaman publik
- Tanggal: 2026-11-14 · Status: **Usulan** (dibahas dengan Jerome)
- Keputusan: aplikasi staf di balik login dibuat sebagai SPA. Landing page dan halaman booking pasien memakai halaman statis/SSR terpisah.
- Alasan: perpindahan layar cepat; data pasien hanya lewat API JSON dengan `Cache-Control: no-store`, tidak tertanam di HTML buatan server atau cache CDN; SPA juga menjadi dasar mode offline (D-026).
- Catatan jujur: keamanan utamanya tetap dari otorisasi di server, RLS, dan header no-store, bukan dari SPA itu sendiri. SPA memindahkan sebagian risiko ke browser (data di memori dan IndexedDB), jadi aturan penyimpanan lokal D-026 wajib.
- Akibat: muatan awal aplikasi sedikit lebih berat; tidak masalah untuk aplikasi kerja harian.

### D-016: Isolasi tenant dengan PostgreSQL RLS + FK gabungan
- Tanggal: 2026-11-14 · Status: **Usulan** (merinci D-003)
- Keputusan: satu skema; semua tabel klinik `ENABLE` + `FORCE ROW LEVEL SECURITY`; aplikasi memakai peran non-pemilik tanpa `BYPASSRLS`; pemilik tabel bukan superuser; view `security_invoker`; setiap transaksi `set_config('app.tenant_id', $1, true)` (= `SET LOCAL`, tapi bisa memakai parameter); semua FK memakai `(tenant_id, id)`. Pencarian nama lewat fungsi sempit karena indeks trigram tidak terpakai di bawah RLS (database.md 7.2, diuji).
- Alasan: dokumentasi PostgreSQL menyebut pemilik tabel biasanya melewati RLS (karena itu `FORCE`), superuser/BYPASSRLS selalu melewati RLS, dan pengecekan FK melewati RLS (karena itu FK gabungan) ([PostgreSQL 18 RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)). Diuji di PostgreSQL 18.7: FK satu kolom menerima pasien tenant lain; FK gabungan menolaknya.
- Pembanding: filter di kode saja (tanpa jaring pengaman), skema/database per klinik (terlalu berat). Lihat architecture.md 13.1.
- Akibat: tes isolasi per tabel wajib di setiap rilis; batas cabang ditegakkan di modul akses data.

### D-017: Catatan klinis = versi yang hanya ditambah
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: `clinical_note` menyimpan identitas dan status; isi ada di `clinical_note_version`; versi yang sudah ditandatangani tidak bisa diubah/dihapus (hak `DELETE`/`TRUNCATE` dicabut + trigger penolak, termasuk `BEFORE TRUNCATE`); draf boleh diubah sampai ditandatangani. Koreksi = versi baru dengan alasan; >2x24 jam lewat `correction_request` (D-013 untuk mode sederhana). Odontogram memakai pola yang sama (`supersedes_id`; status "digantikan" diturunkan, baris final tidak diubah).
- Alasan: Permenkes 24/2022 Pasal 30 dan aturan "tidak pernah ditimpa"; keadaan "final yang diubah diam-diam" menjadi mustahil.
- Akibat: layar membaca versi terbaru; riwayat versi selalu tersedia.

### D-018: Jejak audit dari aplikasi, dipartisi, dengan checkpoint sidik harian
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: satu tabel `audit_event` (partisi bulanan), ditulis dalam transaksi yang sama dengan aksinya lewat satu fungsi; peran aplikasi hanya punya hak `INSERT`/`SELECT`; checkpoint SHA-256 harian per tenant.
- Alasan: trigger database tidak bisa mencatat aksi **baca** (RBA-2). Rantai sidik per baris ditolak karena membuat penulisan audit antre per klinik.
- Akibat: audit tumbuh besar (target seed 200 juta baris); partisi menjaga query tetap cepat.

### D-019: Satu outbox untuk semua kiriman keluar
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: SATUSEHAT dan WhatsApp dikirim lewat tabel `outbox` yang diisi dalam transaksi yang sama dengan aksi asalnya, dengan kunci idempotensi per versi data, diambil pekerja dengan `FOR UPDATE SKIP LOCKED` dan sewa (`lease_until`) yang bisa kedaluwarsa, dan hasil hanya ditulis bila `lease_token` masih cocok. Antrean Laravel (D-029; dulu pg-boss) hanya untuk pekerjaan terjadwal internal.
- Alasan: tidak ada kiriman yang hilang bila server mati; status per cabang (SS-5) dan versi yang terkirim (SS-4) tersimpan sebagai data domain. Aturan sederhana: "semua yang keluar sistem lewat outbox".
- Perlu dicek: cara SATUSEHAT mendeteksi kiriman ganda (identifier / conditional create).

### D-020: Enkripsi per kolom dengan kunci per tenant + blind index
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome, menutup Q-14)
- Keputusan: AES-256-GCM per kolom dengan kunci data per tenant yang dibungkus KMS. NIK, HP, no. kepesertaan dicari lewat blind index HMAC per tenant. Usulan: nama pasien, tanggal lahir, dan kode terstruktur (ICD, gigi, KFA) **tidak** dienkripsi per kolom agar bisa dicari sebagian dan dilaporkan; tetap dilindungi RLS, enkripsi disk, hak akses, dan audit.
- Diputuskan Jerome: nama pasien, tanggal lahir, dan kode terstruktur (ICD-10, ICD-9-CM, kode gigi, KFA) **tidak dienkripsi per kolom**; pencarian sebagian nama memakai indeks trigram. NIK, HP, alamat, dan teks klinis bebas tetap dienkripsi per kolom, NIK/HP dengan blind index.
- Akibat: pengecualian terdokumentasi dari aturan CLAUDE.md dan butir DPIA (compliance.md). Risiko sisa: nama dan kode terbaca bila database bocor. Mitigasi: enkripsi disk dan backup, RLS, peran database hak minimum, audit. Peta lengkap: database.md bagian 5.

### D-021: Odontogram per gigi per permukaan, tanpa tabel ringkasan
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: satu baris per temuan `(gigi FDI, permukaan, kondisi)`, kondisi terkini dihitung dengan `DISTINCT ON` + indeks. Tabel ringkasan baru dibuat jika pengukuran membuktikan perlu.
- Alasan: data per pasien kecil (ratusan baris); satu sumber kebenaran lebih aman dari dua salinan. Cocok dengan Observation per permukaan di use case Gigi SATUSEHAT (kode perlu dicek).

### D-022: Penyimpanan file S3-compatible, dienkripsi aplikasi, bukan MinIO
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: file dienkripsi aplikasi sebelum diunggah, nama objek acak. Prototipe: SeaweedFS di VPS. Produksi: ikut D-010.
- Alasan: enkripsi aplikasi membuat penyedia penyimpanan tidak bisa membaca isi; repositori komunitas MinIO berstatus archived sejak April 2026 ([GitHub minio/minio](https://github.com/minio/minio)), jadi tidak ada perbaikan keamanan.

### D-023: Konvensi data: UUIDv7, rupiah bigint, waktu UTC + zona cabang, tanpa DELETE
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: ID `uuidv7()` (bawaan PostgreSQL 18), uang `bigint` rupiah, `timestamptz` + `branch.timezone` (WIB/WITA/WIT), arsip lewat `archived_at`, peran aplikasi tanpa hak `DELETE` di tabel klinis/keuangan.
- Alasan: ID urut waktu ramah indeks dan bisa dibuat di perangkat offline; retensi 25 tahun (D-005).

### D-024: Anggaran kecepatan dan cara membuktikannya
- Tanggal: 2026-11-14 · Status: **Usulan**
- Keputusan: target p95 per query panas (database.md 7.2) adalah **target, belum diukur**. Pembuktian dengan seed sintetis 5 tahun (300 tenant, 1 juta pasien, 6 juta janji, 40 juta temuan odontogram, 200 juta baris audit), `EXPLAIN (ANALYZE, BUFFERS)` dengan RLS aktif untuk tenant terbesar dan kecil, `pgbench` 3 putaran, dan catatan pembatas setiap angka.
- Akibat: optimasi tambahan hanya dibuat bila angka melewati target.

### D-025: Backup PostgreSQL dengan pgBackRest terenkripsi ke lokasi kedua di Indonesia
- Tanggal: 2026-11-14 · Status: **Usulan** (menunggu Q-6 untuk RPO/RTO)
- Keputusan: backup penuh mingguan, diferensial harian, arsip WAL terus-menerus, terenkripsi, di akun dan lokasi terpisah di Indonesia; uji pemulihan bulanan.
- Sudah dicek ([berita pgBackRest](https://pgbackrest.org/news.html)): bug subkey/garam lemah ada di versi < 2.59.3. Pakai ≥ 2.59.3 (terbaru 2.60.0) sejak `stanza-create` pertama.

### D-026: Mode offline = snapshot kecil terenkripsi + antrean perintah terbatas
- Tanggal: 2026-11-14 · Status: **Usulan** (permintaan Jerome)
- Keputusan: pilihan B di architecture.md 12.1. Perangkat terdaftar per cabang menyimpan jadwal hari ini + kepala pasien hari ini + alergi (+ odontogram terakhir untuk dokter) di IndexedDB terenkripsi (kunci di memori, dibungkus PIN, kunci otomatis saat diam, umur maks 12 jam, dihapus saat logout/dicabut). Service worker hanya menyimpan file aplikasi. Aksi offline terbatas menjadi perintah ber-ID UUIDv7 + kunci idempotensi; konflik diselesaikan manusia, tidak pernah "yang terakhir menang" pada data klinis. Tanda tangan catatan klinis, pembayaran non-tunai/pelunasan, agen AI, SATUSEHAT, dan WhatsApp tidak tersedia offline.
- Alasan: keamanan di atas fitur; kewajiban keamanan pengendali (UU PDP Pasal 35) dan notifikasi kebocoran 3x24 jam (Pasal 46) bila perangkat hilang.
- Pembanding: hanya baca (pindah ke kertas), local-first penuh (terlalu banyak data pasien di perangkat, penggabungan otomatis data klinis).
- Risiko sisa: penyimpanan browser lebih lemah dari server; PIN bisa ditebak di luar aplikasi bila profil browser disalin; perangkat hilang yang tidak pernah online tidak bisa dihapus dari jauh; mencabut perangkat menghapus perintah yang belum terkirim.

### D-027: Dokter boleh melihat riwayat klinis lintas cabang dalam satu tenant
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome, menutup Q-15)
- Keputusan: dokter gigi boleh membuka riwayat klinis pasien dari cabang mana pun dalam tenant yang sama, tanpa diminta alasan. Setiap tampilan lintas cabang tetap ditulis ke audit (`audit_event.cross_branch = true`). Jadwal dan kasir tetap dibatasi per cabang.
- Alasan: kesinambungan perawatan pasien yang pindah cabang; jejak audit menjaga akuntabilitas (Permenkes 24/2022 Pasal 30: hak akses diatur pimpinan fasyankes).
- Akibat: pemilik bisa melihat laporan tampilan lintas cabang dari audit; butir DPIA.

### D-028: Kunci offline: PIN 6 angka, data offline maks 12 jam, mitigasi tebakan PIN
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome, menutup Q-16; merinci D-026)
- Keputusan: PIN 6 angka; snapshot offline maks 12 jam. Mitigasi: KDF kuat (Argon2id via WebAssembly, cadangan PBKDF2-SHA256 iterasi tinggi) dengan garam per perangkat, parameter sekitar 0,5–1 detik per buka di tablet paling lambat (harus diukur); jeda makin panjang tiap salah PIN; salah 5 kali → snapshot dan kunci PIN dihapus; perintah tertunda punya salinan terenkripsi ke kunci publik server supaya penghapusan tidak menghilangkan data; jumlah gagal dan penghapusan dilaporkan ke server.
- Risiko sisa: batas 5 kali hanya berlaku di dalam aplikasi. Penyerang yang menyalin profil browser bisa menebak sejuta kemungkinan PIN di luar aplikasi; perkiraan kasar 1–3,5 hari per inti desktop, jadi **beberapa jam** dengan 8–16 inti (belum diukur). Dampaknya dibatasi data hari itu saja dan umur 12 jam. Perangkat hilang = dugaan kebocoran (UU PDP Pasal 46).

### D-029: Server diganti ke Laravel 13 (API saja) + React SPA terpisah
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome; pilihan database diperbarui oleh D-030)
- Konteks: Jerome sudah memakai Laravel di HRIS Alesco; satu cara kerja untuk semua proyek lebih mudah dirawat. Keberatan lama terhadap Laravel (D-014) adalah **Inertia** yang menaruh data halaman di HTML awal, bentrok dengan D-015 dan mode offline. Masalah itu hilang bila Laravel hanya menjadi API JSON dan React berdiri sendiri sebagai SPA.
- Keputusan:
  - **Server**: Laravel 13 (rilis 17 Mar 2026, PHP 8.3–8.5, perbaikan bug sampai Q3 2027, perbaikan keamanan sampai 17 Mar 2028; versi terbaru 13.42.0 per 10 Nov 2026) ([rilis Laravel 13](https://laravel.com/docs/13.x/releases) · [Packagist laravel/framework](https://packagist.org/packages/laravel/framework)). **API saja, tanpa Inertia, tanpa halaman Blade.** Prototipe memakai PHP 8.4.
  - **Layar staf**: React SPA (Vite) terpisah, tetap sesuai D-015 dan D-026.
  - **Database**: lihat D-030 (MVP di MySQL 8.4 LTS dengan data palsu; target PostgreSQL 18 + RLS sebelum data asli).
- Padanan dari D-014 (yang lama → yang baru):
  | Dulu (D-014) | Sekarang (D-029) | Catatan |
  |---|---|---|
  | Node.js 26 + Fastify | Laravel 13 (PHP 8.4) | API JSON saja |
  | Zod di pintu masuk | Validasi Laravel (`FormRequest`) | semua input dicek sebelum dipakai |
  | Drizzle ORM + migrasi SQL | Migrasi Laravel yang menjalankan **SQL tangan** untuk peran, RLS, `FORCE RLS`, view `security_invoker`, trigger tolak `UPDATE/DELETE`/`TRUNCATE`, fungsi `search_patient` | Eloquent boleh dipakai untuk query biasa; aturan keamanan tetap di database |
  | `packages/db` `withTenant()` | Middleware tenant: buka transaksi per request, jalankan `select set_config('app.tenant_id', ?, true)` dengan parameter | lihat jebakan di architecture.md 11.6 |
  | pg-boss | Antrean Laravel driver `database` (di PostgreSQL yang sama) | pengirim outbox tetap memakai tabel `outbox` + kunci idempotensi + `lease_token` |
  | Better Auth + TOTP | **Laravel Sanctum** (login SPA dengan cookie sesi) + **Laravel Fortify** (login + TOTP) ([Sanctum SPA](https://laravel.com/docs/13.x/sanctum#spa-authentication) · [Fortify 2FA](https://laravel.com/docs/13.x/fortify#two-factor-authentication)) | 2FA Fortify diaktifkan per pengguna, jadi **wajib** ditegakkan oleh middleware kita: semua rute selain pendaftaran 2FA menolak pengguna yang belum mengaktifkan TOTP. "Remember me" dimatikan |
  | `packages/crypto` | Kelas enkripsi kolom dengan kunci **terpisah dari `APP_KEY`** + blind index HMAC | enkripsi Laravel memakai AES-256 + MAC ([Encryption](https://laravel.com/docs/13.x/encryption)); kunci induk tetap harus di KMS sebelum data asli |
  | Vitest (server) | PHPUnit/Pest (server), Vitest (layar), Playwright (browser) | |
- Yang **tidak berubah** (di target PostgreSQL; padanan MVP MySQL di D-030): semua perbaikan hasil review (D-016 sampai D-028): RLS `FORCE`, peran aplikasi non-pemilik tanpa `TRUNCATE`/`DELETE`, FK gabungan `(tenant_id, id)`, fungsi pencarian nama ber-filter tenant dengan indeks trigram, catatan dan odontogram bertanda tangan hanya ditambah (`supersedes_id`), outbox dengan kunci idempotensi + pagar `lease_token`, paginasi keyset, blind index, enkripsi per kolom, audit.
- Alasan: Jerome dan Claude Code sudah terbiasa dengan Laravel; Laravel punya login, antrean, enkripsi, dan migrasi bawaan yang matang. Keamanan data tidak turun karena isolasi tetap ditegakkan PostgreSQL, bukan oleh kode.
- Harga: dua bahasa (PHP di server, TypeScript di layar). Prototipe Node (unit 1 + 1b) diarsipkan di `archive-node/`, desain SQL-nya dipindahkan ke migrasi Laravel.
- Akibat: CLAUDE.md, architecture.md bagian 11, database.md diperbarui. Jangan memakai Inertia atau starter kit Inertia di proyek ini.

### D-030: MVP berjalan di MySQL 8.4 LTS, DATA PALSU SAJA, sampai pindah ke PostgreSQL 18 + RLS
- Tanggal: 2026-11-14 · Status: **Diterima** (Jerome: "MVP pakai MySQL dulu")
- Keputusan: MVP (prototipe lokal dan demo, termasuk Hostinger Cloud Startup) memakai **MySQL 8.4 LTS** (8.4.13, 21 Okt 2026; dukungan aktif sampai 30 Apr 2029, keamanan sampai 30 Apr 2032, [endoflife.date](https://endoflife.date/mysql) · [rilis Okt 2026](https://blogs.oracle.com/mysql/mysql-october-2026-ga-releases-now-available)). **PostgreSQL 18 + RLS tetap target** dan menjadi **gerbang keras sebelum data pasien asli pertama** (compliance.md checklist).
- Catatan versi: LTS terbaru MySQL adalah **9.7** (9.7.0 rilis 21 Apr 2026, terbaru 9.7.4; dukungan sampai 2031/2034). 8.4 dipilih karena lebih umum di hosting terkelola; versi MySQL di Cloud Startup perlu dicek.
- Isolasi di MVP (tanpa RLS): `tenant_id` di setiap tabel tenant, **global scope Eloquent wajib** (trait `BelongsToTenant`, gagal tertutup bila tenant belum di-set), FK gabungan `(tenant_id, id)`, user database aplikasi tanpa `DROP`/`TRUNCATE`/`ALTER`, trigger `BEFORE UPDATE/DELETE` untuk catatan bertanda tangan dan odontogram final, tes arsitektur yang menolak model tenant tanpa trait. Rincian: database.md bagian 11.
- Alasan: Jerome ingin mulai dengan stack yang sama seperti HRIS dan bisa demo di Cloud Startup. Risikonya diterima **hanya** karena datanya palsu.
- Risiko sisa: isolasi bergantung pada kode. Satu query yang melewati global scope = data klinik lain terlihat. Tidak ada jaring pengaman di database. Inilah alasan gerbang keras.
- Akibat: kode harus tetap mudah dipindah (tanpa SQL khusus MySQL di kode aplikasi; SQL khusus MySQL hanya di folder migrasi terpisah). Desain RLS di database.md tetap berlaku sebagai target.

### D-031: Kode dibagi per modul dengan batas yang dites
- Tanggal: 2026-11-14 · Status: **Diterima** (permintaan Jerome: fondasi dulu)
- Keputusan: server dibagi ke `app/Modules/<Modul>` + inti bersama `app/Shared`; modul hanya boleh memakai `Contracts`/`Events` modul lain, sambungan yang diizinkan ditulis di `config/modules.php` dan ditegakkan tes arsitektur. Layar dibagi sama di `src/modules/*` + `src/shared`. Peta: architecture.md "Peta modul".
- Alasan: perubahan di satu bagian (misal tagihan) tidak diam-diam merusak bagian lain (misal rekam medis); Claude Code bisa bekerja per modul dengan konteks kecil.
- Harga: perlu antarmuka kecil antar-modul; relasi model lintas modul dihapus.

### D-032: Masuk cepat khusus pengembangan, tanpa melonggarkan login asli
- Tanggal: 2026-11-14 · Status: **Diterima**
- Keputusan: tombol "Masuk cepat (dev)" tanpa TOTP hanya ada bila `APP_ENV=local` **dan** `DEV_QUICK_LOGIN=true`, hanya untuk akun palsu `*.test`, setiap pemakaian dicatat. Di testing/produksi rutenya tidak ada (404), dibuktikan tes. Login asli tetap wajib TOTP; isolasi tenant tidak berubah.
- Risiko sisa: salah konfigurasi `.env` di server bisa menyalakannya bila `APP_ENV=local` juga salah; cek konfigurasi sebelum demo.


### D-033: Mesin keadaan kunjungan terpisah dari janji, dengan 9 langkah Jerome
- Tanggal: 2026-11-14 · Status: **Usulan** (diperbarui 14 Nov 2026, selaras D-034 sampai D-036 yang diterima)
- Konteks: Jerome menetapkan alur wajib: datang → cek daftar → anamnesis → booking → menunggu → tindakan → hasil + item tagihan → kasir → jadwal berikutnya. Tabel `encounter` di database.md saat ini hanya punya keadaan `berlangsung` dan `selesai`.
- Keputusan: kunjungan punya mesin keadaan sendiri: `datang` → `terdaftar` → `anamnesis` → `antre` → `menunggu` → `di_kursi` → `pasca_tindakan` → `kasir` → `selesai`, plus `batal`. Perpindahan di luar peta ditolak. Janji tetap memakai mesin 4.1 (`dipesan` / `dikonfirmasi` / `check_in` / `dalam_perawatan` / …) dan diselaraskan (cek-in janji membuka kunjungan; selesai/batal harus konsisten). Kunjungan tidak boleh `selesai` sebelum catatan klinis ditandatangani dokter gigi yang merawat, kecuali batal sebelum merawat. Item tagihan boleh terbentuk di `pasca_tindakan` meski SOAP masih draf. Resep dalam kunjungan MVP dicatat terstruktur lalu dicetak dan ditandatangani dokter di kertas (D-036); e-resep SATUSEHAT bukan syarat penutupan kunjungan. Peta lengkap: [flows/kunjungan.md](flows/kunjungan.md).
- Alasan: keselamatan (identitas, alergi, tanda tangan) tidak boleh dilompati; UU 17/2023 Pasal 296 ayat 3–4 (rekam dilengkapi segera, ada nama/waktu/tanda tangan); Permenkes 24/2022 Pasal 16 ayat 2.
- Akibat: `encounter.state` di database.md perlu diperluas; tes transisi wajib di modul Clinical.

### D-034: Bagi hasil dokter bersifat konfigurasi bertanggal, hanya pemilik
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-17, 14 Nov 2026)
- Konteks: Jerome: bagi hasil dokter bisa berbeda-beda.
- Keputusan: aturan bagi hasil diatur per dokter dan per kelompok tindakan, boleh persentase atau nominal tetap, dan boleh dihitung sebelum atau sesudah biaya bahan/lab. **Default:** dihitung **sesudah** biaya bahan dan lab dikurangi. Pemilik tetap boleh mengatur pengecualian per dokter atau kelompok tindakan, dengan tanggal mulai berlaku; aturan lama tidak dihapus. Perhitungan untuk tindakan yang sudah lewat **tidak diubah** saat aturan baru disimpan. Pengaturan bagi hasil hanya diatur pemilik; kasir tidak melihat pengaturan atau laporan. Setiap ubahan, unduhan, atau buka laporan tercatat di jejak audit. **Amandemen D-039 (jawaban Q-20, 14 Nov 2026):** dokter boleh melihat laporan bagi hasil miliknya sendiri, hanya baca, tanpa aturan atau angka dokter lain. Pemilik tetap melihat laporan semua dokter.
- Alasan: perjanjian antar dokter sering berbeda; mengubah angka bulan lalu merusak kepercayaan dan pembukuan. Jerome menetapkan default sesudah bahan dan lab, karena itu yang biasanya menjadi dasar bagi hasil.
- Akibat: modul Compensation terpisah (architecture.md); aturan baru tanpa pilihan eksplisit memakai default sesudah bahan/lab.

### D-035: Tarif mendukung tingkat kesulitan; dokter memilih tingkat, bukan mengetik harga
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-18, 14 Nov 2026)
- Konteks: Jerome: kesulitan tambalan bisa berbeda-beda.
- Keputusan: daftar tarif boleh punya beberapa tingkat per tindakan. Bitto menyediakan **templat awal yang bisa diubah** (contoh: tambalan menurut jumlah permukaan atau tingkat kerumitan). Templat ini hanya titik awal pengaturan tarif, **bukan panduan klinis**. Klinik boleh mengubah, menambah, atau menghapus tingkat. Dokter, saat mencatat tindakan selesai, memilih tingkat; tingkat tertinggi wajib diisi alasan. Sistem (modul Billing dari Tariffs) yang mengisi harga, lalu menyalin angka itu ke baris tagihan. Perubahan tarif kemudian tidak mengubah tagihan lama. Tingkat boleh mempengaruhi bagi hasil jika pemilik mengaturnya. Modul Clinical tidak bergantung pada Billing atau Tariffs.
- Alasan: harga yang diketik tangan mudah salah dan sulit diaudit; foto harga menjaga tagihan dan bagi hasil tetap cocok dengan yang berlaku di hari tindakan. Templat mempercepat setup tanpa mengunci klinik pada satu skema, dan tidak boleh dibaca sebagai standar medis.
- Akibat: templat awal ikut seed data palsu; layar pengaturan tarif menampilkan catatan “bukan panduan klinis”. Kuitansi menampilkan nama tindakan dan tingkat, tanpa diagnosis.

### D-036: Resep MVP tercetak dan ditandatangani dokter; data tersimpan terstruktur; e-resep SATUSEHAT menyusul
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-19, 14 Nov 2026)
- Konteks: Jerome meminta fitur resep. Teks peraturan berikut dibaca langsung dari PDF resmi pada 14 Nov 2026. Modul kefarmasian SATUSEHAT pada dokumentasi yang sama masih sandbox.
- Keputusan:
  1. **MVP:** resep adalah resep tertulis biasa: dicetak dari Bitto dan **ditandatangani dokter gigi di kertas**. Data resep tetap disimpan terstruktur di Bitto (obat dengan kode **KFA**, dosis, rute, frekuensi, durasi). Formulir cetak memuat isi wajib Permenkes 34/2021 Pasal 7. Salinan yang dicetak (sidik isi) tersimpan agar cocok dengan data terkunci.
  2. Hanya dokter gigi berizin (Tenaga Medis, SIP aktif di cabang) yang membuat dan mengunci resep di sistem, lalu mencetaknya untuk ditandatangani. Asisten, kasir, pemilik, dan agen AI tidak meresepkan dan tidak memilih obat.
  3. Sistem menampilkan peringatan alergi dan obat dobel, plus alasan jika dokter tetap lanjut. Sistem **tidak** menyarankan atau mengganti obat.
  4. Resep yang sudah dikunci/dicetak tidak bisa diubah. Koreksi = batal dengan alasan + terbit ulang (nomor baru) lalu cetak lagi. Resep lama tetap tersimpan.
  5. **Bukan MVP:** kirim resep lewat WhatsApp, kode/QR e-resep, dan e-resep SATUSEHAT (`MedicationRequest` / Nomor Resep Nasional). Itu menyusul setelah modul kefarmasian SATUSEHAT keluar dari sandbox.
- Dasar yang sudah dibaca:
  - [UU 17/2023](https://peraturan.go.id/id/uu-no-17-tahun-2023) Pasal 1 angka 6 (Tenaga Medis mencakup pendidikan kedokteran gigi); Pasal 285 (praktik sesuai kewenangan berdasarkan kompetensi); penggunaan obat narkotika dan psikotropika hanya berdasarkan resep Tenaga Medis; Pasal 320 (obat dengan resep diserahkan apoteker). PDF: [jdih.kemkes.go.id 2023uu017](https://jdih.kemkes.go.id/storage/documents/pdfs/2023uu017.pdf).
  - [PP 28/2024](https://peraturan.go.id/id/pp-no-28-tahun-2024) Pasal 917 ayat 4 (resep = permintaan Tenaga Medis kepada apoteker, tertulis fisik atau elektronik); Pasal 924 (pelayanan obat dengan resep boleh elektronik, wajib lewat Sistem Informasi Kesehatan yang terintegrasi Sistem Informasi Kesehatan Nasional; e-resep telemedisin dikecualikan untuk narkotika, psikotropika, dan sediaan lain yang ditetapkan Menteri; ketentuan lanjut diatur Peraturan Menteri). PDF: [peraturan.go.id/files/pp-no-28-tahun-2024.pdf](https://peraturan.go.id/files/pp-no-28-tahun-2024.pdf).
  - [Permenkes 34/2021](https://jdih.kemkes.go.id/documents/peraturan-menteri-kesehatan-nomor-34-tahun-2021) Pasal 1 angka 6 (resep = permintaan tertulis dari **dokter atau dokter gigi** kepada apoteker, tertulis maupun elektronik); Pasal 7 (isi wajib: nama dokter, SIP, alamat praktik, paraf, tanggal, nama dan usia pasien, nama/bentuk/kekuatan/jumlah/aturan pakai obat; boleh elektronik); Pasal 10 (resep rahasia, disimpan di instalasi farmasi paling singkat 5 tahun — ini retensi resep di farmasi, terpisah dari retensi rekam medis 25 tahun). PDF: [2021permenkes034](https://jdih.kemkes.go.id/storage/documents/pdfs/2021permenkes034.pdf).
  - Pemetaan SATUSEHAT: [Pelayanan Kefarmasian](https://satusehat.kemkes.go.id/platform/docs/id/interoperability/kefarmasian/) dan [MedicationRequest](https://satusehat.kemkes.go.id/platform/docs/id/fhir/resources/medication-request/) · use case [Gigi](https://satusehat.kemkes.go.id/platform/docs/id/interoperability/rawat-jalan-gigi/).
- Yang **belum terverifikasi**: daftar obat yang masuk atau di luar kewenangan dokter gigi secara rinci (Pasal 285 menunjuk Peraturan Pemerintah; standar profesi belum kami baca); Peraturan Menteri turunan Pasal 924 ayat 5 untuk tata cara e-resep (termasuk narkotika di klinik, bukan telemedisin); kesiapan produksi Nomor Resep Nasional untuk klinik gigi (dokumentasi kefarmasian SATUSEHAT yang dibaca 14 Nov 2026 menyatakan modul masih dikembangkan dan hanya di sandbox, v1.3 28 Nov 2024).
- Akibat: cerita RSP-3 (cetak) wajib di MVP; RSP-8 (WhatsApp) dan RSP-9 (SATUSEHAT MedicationRequest) turun ke Nanti; AI/scribe tidak boleh mengisi kamus obat.


### D-037: Dikte dokter (suara→teks) hanya menjadi draf; pemrosesan di Indonesia
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome, 14 Nov 2026)
- Konteks: dokter ingin mendikte, bukan mengetik dari nol. Suara adalah data kesehatan (UU PDP Pasal 4). Retensi audio diputuskan terpisah di D-038 (Q-4).
- Keputusan:
  1. Dikte hanya boleh oleh dokter gigi yang merawat, dan hanya jika pasien sudah setuju direkam. *Syarat persetujuan pasien diusulkan untuk digantikan oleh D-048 (menunggu konfirmasi).*
  2. Hasilnya **draf berlabel**, masuk SOAP dan/atau odontogram. Tidak pernah jadi rekam medis sebelum dokter meninjau dan menandatangani (D-001).
  3. AI hanya menuliskan ulang dan merapikan yang diucapkan. Dilarang menambah diagnosis, obat, atau kode yang tidak diucapkan.
  4. Pemrosesan hanya di Indonesia, in-region, tanpa Geo/Global (D-009). Calon: Bedrock Jakarta `mistral.voxtral-mini-3b-2507` ([kartu model](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-mistral-ai-voxtral-mini-3b-2507.html), In-Region didukung di `ap-southeast-3`). Amazon Transcribe **tidak** tersedia di Jakarta ([daftar wilayah](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) · [endpoint](https://docs.aws.amazon.com/general/latest/gr/transcribe.html)). Akurasi istilah gigi Bahasa Indonesia: perlu uji.
  5. Dikte **tidak tersedia offline** (D-026).
- Alasan: privasi dan keselamatan klinis; dokter tetap pemegang keputusan.
- Akibat: cerita SOAP-2, SOAP-5; agen scribe di agents.md. Retensi audio: D-038. Tinjauan peran: [research/review-peran.md](research/review-peran.md).

### D-038: Audio dikte dihapus setelah catatan ditandatangani
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-4, 14 Nov 2026)
- Konteks: suara pasien adalah data kesehatan (UU PDP Pasal 4). Menyimpan audio lebih lama dari perlu menambah risiko kebocoran.
- Keputusan: setelah dokter gigi yang merawat menandatangani catatan yang berasal dari dikte, **berkas audio dihapus**. **Transkrip** dan **selisih draf versus versi akhir** tetap tersimpan di jejak audit. Audio tidak disimpan sebagai bukti secara bawaan. Selama catatan masih draf, audio boleh diputar ulang oleh dokter yang merawat dan belum dihapus.
- Alasan: Jerome memilih menghapus audio setelah tanda tangan, bukan menyimpannya sebagai bukti.
- Akibat: cerita SOAP-7; agen scribe wajib mencatat waktu audio dihapus.

### D-039: Dokter boleh melihat laporan bagi hasil miliknya sendiri, hanya baca
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-20, 14 Nov 2026)
- Konteks: D-034 semula membatasi laporan bulanan hanya untuk pemilik.
- Keputusan: dokter gigi boleh membuka **laporan bagi hasil miliknya sendiri**, **hanya baca**. Dokter **tidak** melihat aturan atau angka dokter lain, dan **tidak** mengubah pengaturan bagi hasil. Pengaturan dan laporan seluruh dokter tetap hanya untuk pemilik. Setiap buka atau unduh tercatat di jejak audit.
- Alasan: dokter perlu mencocokkan haknya tanpa melihat perjanjian kolega.
- Akibat: mengubah sebagian D-034 (akses laporan); cerita BGH-4. Kasir tetap tidak melihat laporan atau pengaturan.

### D-040: Pemilik boleh membuka catatan klinis, hanya baca, setiap buka tercatat
- Tanggal: 2026-11-14 · Status: **Diterima** (Jawaban Jerome atas Q-21, 14 Nov 2026)
- Konteks: di aplikasi, peran `owner` sudah punya `note.read`. Usulan tinjauan semula: pemilik yang bukan dokter tidak membuka catatan, kecuali akses darurat yang tercatat. Jerome memilih sebaliknya: pemilik **boleh** membuka catatan, meski bukan dokter.
- Keputusan:
  1. Pemilik klinik (meski bukan dokter) **boleh membuka** catatan klinis.
  2. Hanya **baca**. Tidak ada `note.sign`, tidak boleh mengubah atau menandatangani catatan dokter lain.
  3. Setiap kali catatan dibuka, jejak audit mencatat **siapa, kapan, dan pasien mana**. Catatan itu tampil di **layar audit pemilik** dan tidak bisa diubah atau dihapus.
  4. Hak akses ini **dijelaskan di pemberitahuan privasi** kepada pasien.
  5. Izin `note.read` untuk pemilik di aplikasi **dipertahankan**; yang wajib ditambah adalah pencatatan setiap baca (cerita RBA-10). Kode aplikasi tidak diubah di putaran ini.
- Alasan: Jerome menetapkan pemilik boleh meninjau catatan. Pengaman di atas mengikuti prioritas privasi.
- Akibat: cerita RBA-10; risiko data spesifik dicatat di compliance.md (UU PDP Pasal 4, tanpa menambah nomor pasal yang belum diverifikasi).

### D-041: Tanda tangan catatan klinis hanya oleh dokter penulisnya, dengan konfirmasi ulang
- Tanggal: 2026-11-14 · Status: **Diterima** (dibangun di prototipe, unit C2)
- Keputusan: hanya peran dokter gigi **dan** penulis draf yang boleh menandatangani. Tanda tangan butuh centang "sudah saya periksa" + kode TOTP diketik ulang di permintaan yang sama. Catatan SOAP + temuan odontogram kunjungan itu dikunci sekaligus, dengan sidik isi SHA-256. Koreksi = versi baru dengan alasan (min. 10 huruf). Lebih dari 2x24 jam: praktik dengan satu dokter menyetujui sendiri dengan alasan tercatat (D-013); lebih dari satu dokter: pemilik menyetujui dulu.
- Dites: bukan dokter → 403, dokter lain → 403, tanpa/salah konfirmasi → 403, ubah setelah tanda tangan → 409 + ditolak trigger database.

### D-042: Dokter tidak bisa dijadwalkan di dua kursi pada jam yang sama
- Tanggal: 2026-11-14 · Status: **Diterima** (unit C1)
- Keputusan: janji ditolak (409 `dentist_busy`) bila dokter yang sama sudah punya janji aktif yang tumpang tindih di kursi atau cabang mana pun dalam klinik itu. Janji batal/tidak datang diabaikan; janji yang bersambung (selesai = mulai) boleh. Kunci baris kursi lalu dokter dalam satu transaksi. Di PostgreSQL nanti: constraint `EXCLUDE` per dokter.
- Belum dibuktikan: uji dua permintaan benar-benar bersamaan.

### D-043: Celah model data dari Open Dental masuk MVP
- Tanggal: 2026-11-14 · Status: **Diterima** (unit C3, data palsu)
- Keputusan: status tindakan terpisah dari kondisi gigi (kondisi/pantau, ada di klinik ini, ada di tempat lain, direncanakan, selesai, dirujuk); keadaan dasar gigi saat kunjungan pertama (tetap/sulung/campuran, ada/hilang/belum tumbuh), berversi; keluarga + penanggung biaya + wali; peringatan medis selalu tampil + riwayat medis berversi; janji terencana dari dokter yang dijadwalkan resepsionis; stempel datang/duduk/selesai; log pengingat yang mencegah kirim ulang; penyesuaian tagihan terpisah dari baris tagihan. Baris tagihan dibuat dari tindakan berstatus selesai dengan salinan harga (D-035). Sumber: research/opendental-schema-gaps.md.

### D-044: Peran kasir
- Tanggal: 2026-11-14 · Status: **Diterima** (unit 0d)
- Keputusan: peran `kasir`: tagihan + penyesuaian, data identitas pasien (NIK tersamar), jadwal; **tanpa** catatan klinis, odontogram, atau riwayat medis (ditolak dan tercatat di audit). Peringatan medis sama dengan resepsionis (alergi, perlu premedikasi, "ada catatan penting" tanpa isinya).
- Perlu dicek: apakah kasir boleh membuat penyesuaian (diskon/hapus piutang) atau hanya melihat.

### D-048: Scribe suara tanpa langkah persetujuan rekam pasien dan tanpa pemberitahuan privasi klinik
- Tanggal: 2026-11-15 · Status: **Usulan — menunggu konfirmasi langsung Yohanes** (disampaikan lewat agen UI/UX 15 Nov 2026 20:59 WIB; persetujuan yang diteruskan agen lain belum dihitung)
- Konteks: papan desain "AI & input cepat" (celah KlinikMe) menaruh mikrofon scribe di HP dokter. D-009 butir 4 mewajibkan persetujuan pasien eksplisit untuk perekaman selama scribe masih beta, dan D-037 butir 1 mensyaratkan pasien sudah setuju direkam. Yohanes memutuskan langkah itu tidak dipakai.
- Keputusan:
  1. Scribe suara (D-037) berjalan **tanpa langkah persetujuan rekam dari pasien** dan **tanpa pemberitahuan privasi klinik** khusus perekaman.
  2. Mikrofon **selalu tersedia** untuk dokter gigi yang merawat.
  3. Keluaran scribe tetap **draf** sampai dokter menekan Setujui lalu Selesai (D-001). AI tetap hanya merapikan yang diucapkan, tanpa menambah diagnosis, obat, atau kode (D-037 butir 3).
  4. Audio dihapus setelah Selesai (D-038).
  5. Pemrosesan tetap di Indonesia, in-region, tanpa Geo/Global. Butir lain D-009 tetap berlaku.
  6. Bila dikonfirmasi, keputusan ini **menggantikan D-009 butir 4** dan syarat persetujuan pasien di D-037 butir 1. Sampai saat itu teks lama tetap berlaku dan hanya diberi catatan; setelah konfirmasi baru dicoret (tidak dihapus).
- Alasan: keputusan produk Yohanes agar dikte tidak menambah langkah di kursi.
- Akibat/Risiko:
  - Dasar pemrosesan menurut UU PDP untuk perekaman suara pasien, dan ketiadaan pemberitahuan kepada pasien, **perlu dikaji konsultan hukum**.
  - DPIA di compliance.md perlu memuat perekaman tanpa persetujuan dan tanpa pemberitahuan ini sebagai butir tersendiri.
  - UI tidak menampilkan langkah izin pasien. Jejak audit tetap mencatat siapa merekam, kapan, untuk pasien mana, dan kapan audio dihapus.

## Pertanyaan terbuka (perlu jawaban Jerome)
- ~~Q-1 Target klinik~~ → **ditutup**: semua ukuran (D-007).
- ~~Q-2 BPJS di MVP?~~ → **ditutup**: tidak, model data siap BPJS (D-008).
- ~~Q-3 Lokasi pemrosesan AI~~ → **ditutup**: D-009 diterima.
- ~~Q-8 Persetujuan D-009~~ → **ditutup**: diterima Jerome.
- ~~Q-9 Cloud utama~~ Ditutup: lihat D-010 (diterima).
- ~~Q-10~~ Ditutup 2026-11-14, Jerome setuju: Setuju Hostinger dipakai dulu untuk prototipe/demo dengan data palsu, dan keputusan cloud produksi (Hostinger VPS Jakarta vs AWS Jakarta) ditunda sampai Hostinger menjawab soal sertifikasi, lokasi backup, dan penerimaan data kesehatan?
- ~~Q-4~~ Ditutup 14 Nov 2026: hapus audio dikte setelah catatan ditandatangani; transkrip dan selisih draf vs versi akhir tetap di jejak audit (D-038).
- Q-5 Tanda tangan elektronik: cukup login + PIN, atau TTE tersertifikasi?
- Q-6 Target RPO/RTO backup.
- Q-7 Asuransi swasta mana yang diprioritaskan?
- ~~Q-11~~ Ditutup 2026-11-14: lihat D-011.
- ~~Q-12~~ Ditutup 2026-11-14: tanda tangan lihat D-012. Daftar tindakan invasif tetap terbuka: ditetapkan oleh dokter gigi berizin yang meninjau.
- ~~Q-13~~ Ditutup 2026-11-14: lihat D-013.
- ~~Q-14~~ Ditutup 2026-11-14: lihat D-020 (diterima).
- ~~Q-15~~ Ditutup 2026-11-14: lihat D-027.
- ~~Q-16~~ Ditutup 2026-11-14: lihat D-028.
- ~~Q-17~~ Ditutup 14 Nov 2026: default bagi hasil dihitung **sesudah** biaya bahan dan lab dikurangi (D-034).
- ~~Q-18~~ Ditutup 14 Nov 2026: Bitto menyediakan templat tingkat kesulitan yang bisa diubah (misal tambalan menurut jumlah permukaan atau kerumitan); templat hanya titik awal, bukan panduan klinis (D-035).
- ~~Q-19~~ Ditutup 14 Nov 2026: MVP = resep tercetak dan ditandatangani dokter (resep tertulis biasa), data tersimpan terstruktur dengan kode KFA; e-resep SATUSEHAT (MedicationRequest / Nomor Resep Nasional) menyusul setelah modul keluar dari sandbox (D-036).
- ~~Q-20~~ Ditutup 14 Nov 2026: dokter boleh melihat laporan bagi hasil miliknya sendiri, hanya baca, tanpa aturan atau angka dokter lain (D-039).
- ~~Q-21~~ Ditutup 14 Nov 2026: pemilik (meski bukan dokter) boleh membuka catatan klinis, hanya baca, tanpa tanda tangan atau ubahan; setiap buka tercatat dan dijelaskan di pemberitahuan privasi (D-040).
