# Benchmark skala SaaS — Bittodent (data sintetis)

Status: hasil run 14 Nov 2026, Asia/Jakarta, cabang `bench/scale`. **Bukan angka produksi.** Semua baris dan citra bersifat sintetis (NIK prefiks 99, email `*.test`, label citra `SYNTHETIC`). Database `ehr_bench` — `ehr_dev` / `ehr_test` tidak diubah.

Klaim ditulis *sebelum* mengukur: `tools/bench/CLAIMS.md`. Rancangan pencitraan: `docs/architecture/IMAGING.md`. Target acuan: `docs/database.md` §7.2 (Q4 < 50 ms DB, Q5 NIK/HP, Q6 < 60 ms DB / < 300 ms layar, Q7 < 20 ms DB, Q13 < 100 ms jejak entitas 3 bulan).

## 1. Keputusan yang ingin diubah oleh run ini

1. Apakah endpoint MySQL saat ini, di plafon 1 penyewa / 10.000 pasien / ~10 tahun, memenuhi atau melewatkan target §7.2?
2. Apa limiter-nya — `php artisan serve` (satu permintaan per proses), tabel `audit_event` tanpa partisi, `PatientSearch` LIKE / OR, chart yang mendekripsi semua versi SOAP, atau yang lain? Limiter disebut dari hitungan (EXPLAIN, `X-Bench-Query-Count`, p95 vs konkurensi), bukan tebakan.
3. Codec lossless mana yang dipakai untuk asli rontgen, dan berapa biaya compress-then-encrypt + unggah/buka?

## 2. Metode

- Seeder massal (bukan Eloquent per baris): `php artisan bench:seed` (`app/Console/Commands/BenchSeedCommand.php`). Hanya jalan jika koneksi admin = `ehr_bench`.
- HTTP: sesi Sanctum terpisah per pengguna virtual (driver sesi `database` — satu sesi dipakai bersama akan mengunci baris). Pemanasan, lalu p50/p95/p99, jumlah error, jumlah query, konfirmasi isi respons (baris yang diharapkan, bukan hanya kode 200). Konkurensi 1 / 10 / 50.
- Citra: `tools/bench/imaging_bench.py`, 1 pemanasan dibuang, 5 ulangan, putar-balik piksel wajib identik untuk lossless; selubung wajib gagal jika satu bit dijungkirkan.
- MySQL di-tune hanya pada buffer: `innodb_buffer_pool_size=2G` (sebelumnya 128M di kotak ini), `innodb_redo_log_capacity=512M`. `performance_schema=OFF`. Ini bukan MySQL produksi, tetapi 128M akan membuat setiap tabel besar menjadi limiter palsu.
- Server aplikasi: `php artisan serve` (`php -S`, **satu permintaan pada satu waktu**). Bukan FrankenPHP/Octane/FPM. Angka konkurensi 10/50 mengukur antrean server, bukan skala produksi. Percobaan 4 worker + proksi buatan gagal (proksi HTTP rusak); C1 tetap terbaca dari penskalaan linier p95 di server tunggal.

## 3. Perangkat (kotak ini)

| | |
| --- | --- |
| CPU | 8× Intel Xeon, 1 thread/inti |
| RAM | 15 Gi, tanpa swap |
| Disk | 128 G (`/dev/vdb`), sisa ~113 G setelah run A |
| OS | Debian, kernel 6.12 |
| PHP | 8.4.14 NTS |
| MySQL | 8.4.13, bind 127.0.0.1, buffer pool 2 GiB |
| Zona waktu laporan | Asia/Jakarta (UTC+7) |

## 4. Volume yang di-seed

**Skenario A** (penuh, 1 penyewa): 10.000 pasien, target 1,2 kunjungan/pasien/tahun × 10 tahun, 8 temuan/kunjungan, ~1,3 versi catatan, 30 audit/kunjungan + 5/pasien/tahun.

| Tabel | Baris (COUNT) | Data + indeks |
| --- | ---: | ---: |
| `audit_event` | 4.100.840 | 2.896 MiB |
| `tooth_finding` | ~960.000 | 868 MiB |
| `clinical_note_version` | 160.024 | 218 MiB |
| `appointment` | ~120.100 (termasuk janji hari ini/besok) | 141 MiB |
| `invoice` | 119.988 | 121 MiB |
| `visit` | 120.028 | 112 MiB |
| `clinical_note` | ~120.000 | 80 MiB |
| `prescription` + item | ~24.000 (draf; trigger menolak item pada resep sudah dikunci) | 49 MiB |
| `patient` | 10.000 | 24 MiB |
| **Total `ehr_bench` setelah A** | | **4.509 MiB** |

Waktu seed A: **371,4 s**. Satu pasien “berat” 40 kunjungan; pasien tipikal 12 kunjungan.

**Catatan sebaran waktu (keterbatasan seeder):** slot kursi diisi dari awal jendela (2016-11-14) sampai kapasitas terpenuhi, sehingga `created_at` kunjungan/invoice berakhir pada **2021-02-16**, lalu ada jeda sampai janji “hari ini” (2026-11-14). Jumlah kunjungan sesuai 1,2 × 10 tahun, tetapi **tidak merata sepanjang 10 tahun**. Audit per-pasien-tahun memang disebar 10 tahun. Perbaikan seeder (round-robin per hari) belum diterapkan di run ini.

**Skenario B (diperkecil):** 20–50 penyewa × 5.000 pasien × 10 tahun tidak muat secara wajar (itu ~20–50× skenario A). Yang dijalankan: **10 penyewa × 2.000 pasien × 1 tahun**, `--append`, label B (54,0 s).

Setelah A+B: 11 penyewa, 30.000 pasien, 140.458 kunjungan, 4.813.454 `audit_event`, **5.327 MiB** total (audit 3.472 MiB). NIK sintetis `9901000000000001` dipakai ulang di penyewa A dan B-01 (unik hanya per `(tenant_id, nik_bidx)`).


## 5. Hasil HTTP skenario A (`php artisan serve` :8001)

Nol error pada endpoint yang diukur, kecuali unggah citra pertama kali (`upload_max_filesize=2M` menolak JXL 2,39 MiB). Semua konfirmasi isi lolos. `X-Bench-Query-Count` stabil per endpoint (termasuk query konteks tenant + tulis audit di `show`/`chart`).

### 5.1 Konkurensi 1 — angka yang dipakai untuk membandingkan ke target §7.2

| Endpoint | n | p50 ms | p95 ms | p99 ms | Query | Bytes | vs target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cari nama `q=sari` | 30 | 23,7 | **37,4** | 50,8 | 4 | 6,0 K | HTTP p95 < 50 ms di skala ini (Q4). Rencana SQL *tidak* memakai indeks prefiks nama — lihat §6. |
| Cari NIK | 30 | 66,2 | **99,8** | 100,4 | 4 | 262 | **Lewat** 50 ms. Lebih lambat dari cari nama. |
| Cari HP | 30 | 64,0 | **80,1** | 93,7 | 4 | 262 | **Lewat** 50 ms (pola sama). |
| Detail pasien | 30 | 19,0 | 24,1 | 24,4 | 6 | 421 | Aman. |
| Chart tipikal (12 kunjungan) | 30 | 44,3 | **51,9** | 52,2 | 14 | 20 K | Layar < 300 ms (Q6) terpenuhi. Q7 (20 ms DB, DISTINCT ON) *tidak* terisolasi: odontogram dihitung di PHP setelah memuat semua temuan + mendekripsi semua SOAP. |
| Chart berat (40 kunjungan) | 20 | 138,5 | **152,2** | 153,7 | 14 | 210 K | Masih < 300 ms di kotak ini. |
| Jadwal hari ini (sebelum perbaikan) | 30 | 187,1 | **232,4** | 293,6 | 9 | 72 K | Baca “hari ini” terslow; hampir menyentuh 300 ms. |
| Jadwal hari ini (**setelah** batas bawah `starts_at`, 7 ulangan) | 7 | **40,6** | 43,3 (max) | — | 9 | 72 K (80 janji) | ~4,6× lebih cepat, jumlah janji sama. |
| Daftar invoice jendela kosong (30 hari 2026) | 30 | 99,1 | 152,9 | 157,1 | 4 | 21 | Jendela salah (sebaran kunjungan, §4); tetap memakan ~100 ms karena pindai tenant. |
| Daftar invoice Jan–Feb 2021 (ada 50 baris, 7 ulangan) | 7 | **92,2** | 104,7 (max) | — | 4 | 10 K | Masih ~90 ms untuk 50 baris. |
| Audit entitas 90 hari | 30 | 16,9 | **21,5** | 21,8 | 4 | 27 K | **Memenuhi** Q13 100 ms. |
| Audit entitas 10 tahun (LIMIT 100) | 20 | 16,4 | **17,7** | 19,1 | 4 | 27 K | Sama; indeks terpakai. |
| Buat kunjungan (atau idempoten) | 40 | 20,0 | 22,2 | 24,1 | 9→5 | 322 | Aman. |
| Simpan draf catatan | 10 | 22,0 | 31,3 | 31,3 | 10 | 215 | Aman. Tanda tangan HTTP tidak di-load (TOTP sekali-pakai / 30 s). |
| Unggah pano JXL + selubung | 5 | **59,1** | 62,8 (max) | — | — | 2,40 J envelope | Setelah `upload_max=32M`. |
| Buka pano (stream dekripsi) | 5 | **29,9** | 32,6 (max) | — | 5 | 2.396.415 | SHA dan label `SYNTHETIC` cocok. |
| Buka thumbnail JPEG | 5 | **21,3** | 24,0 (max) | — | 5 | 2.793 | — |

Tanda tangan catatan tidak diukur berulang: kode TOTP hanya sah sekali per jendela, dan itu *memang* limiter produksi untuk tanda tangan masal, bukan bug bench.

### 5.2 Konkurensi 10 dan 50 (server bawaan, antrean)

Tidak ada error. p95 naik hampir linier dengan C (contoh cari nama: 37 ms → 233 ms → 1214 ms; chart berat: 152 ms → 1547 ms → 7432 ms; jadwal sebelum perbaikan: 232 ms → 2159 ms → 10077 ms). Ini antrean `php -S`, bukan query yang tiba-tiba 50× lebih lambat (jumlah query per permintaan tetap). Klaim C1 **diterima**.

## 6. EXPLAIN (MySQL 8.4, setelah `ANALYZE TABLE`)

- **Cari nama:** `ORDER BY created_at, id` membuat optimizer memilih `patient_tenant_id_created_at_id_index` lalu *filter* `LIKE 'sari%' OR LIKE '% sari%'` (perkiraan ribuan baris). Indeks prefiks `(tenant_id, name_normalized(64))` **tidak terpakai**. Di 10.000 pasien hasilnya masih 37 ms; ini akan memburuk bila pasien/penyewa bertambah tanpa pindah ke `search_patient` (rencana PostgreSQL, `docs/database.md`).
- **Cari NIK/HP (OR):** pindai `PRIMARY (tenant_id)` lalu filter `nik_bidx OR phone_bidx` — **bukan** indeks unik/bidx. Kesetaraan *tanpa* OR: `nik_bidx` / `phone_bidx` = lookup 1 baris (cost ~0,8). Limiter-nya bentuk SQL, bukan data 10k.
- **Jadwal (sebelum perbaikan):** `starts_at < akhir-hari` tanpa batas bawah memakai `appointment_tenant_id_chair_id_starts_at_index` tetapi merentang **seluruh sejarah kursi** (~48k baris/kursi di EXPLAIN), lalu memfilter `ends_at`. Setelah batas bawah `starts_at >= awal-hari-1`, HTTP p50 187 → 41 ms.
- **Audit entitas:** *index range scan* pada `(tenant_id, entity_type, entity_id, occurred_at)` untuk 90 hari (cost 1,7) dan 10 tahun (cost 118, ~122 baris, LIMIT 100). Unpartitioned 4,1 juta baris **tidak** membuat Q13 lambat di akses per-entitas.
- **Daftar invoice:** pindai `PRIMARY (tenant_id)` (~59k–120k baris) + filter `branch_id` dan `created_at`, filesort LIMIT 50. Tidak ada indeks `(tenant_id, branch_id, created_at, id)`.
- **Chart:** `visit (tenant_id, patient_id, started_at)` 12 baris; `tooth_finding (tenant_id, patient_id, tooth)` lalu filesort (~96 / 320 baris). Bukan full scan.

Cuplikan: `tools/bench/out/explain.md`.

## 7. Pencitraan

Lihat tabel lengkap di `IMAGING.md` §7. Ringkas: asli = **JPEG-XL lossless** (rasio 3,39× pano, 3,43× periapikal, putar-balik ok); thumb terpisah = JPEG q70. Selubung +217 B, ~1 GiB/s, bit-flip tertangkap. Unggah HTTP 59 ms, buka 30 ms (termasuk audit). `upload_max_filesize=2M` harus dinaikkan sebelum pano 12/16-bit.


## 8. Skenario B (multi-tenant, diperkecil)

Target 20–50 × 5.000 × 10 tahun **diperkecil** menjadi **10 × 2.000 × 1 tahun** (disk/RAM). Seed `--append` dalam 54,0 s.

Isolasi (C7) **diterima:** login dokter A vs dokter B-01, pencarian NIK yang sama mengembalikan *satu* id berbeda (A `01a1d9ec-e013-7238-bf01-4f9272b163fa`, B `01a1d9f9-3b26-73ba-9aae-4018df4bd4d7`), tidak bocor. Halaman `q=sari` 25+25 baris **disjoin**. `BelongsToTenant` bekerja di MySQL (ini bukan uji RLS PostgreSQL).

“Noisy neighbor”: selama 10 sesi B memukul `/api/patients?q=sari`, p50 cari nama A naik 18,8 ms → 208,9 ms. Itu **bukan** bukti noisy-neighbor di InnoDB — `php -S` mengantri semua permintaan dalam satu proses (selaras C1). Uji noisy-neighbor database memerlukan server multi-proses yang tidak berhasil kami pasang di run ini.


## 9. Klaim: diterima atau ditolak

| Klaim | Putusan | Bukti |
| --- | --- | --- |
| C1 php -S mengantre di C=10/50 | **Diterima** | p95 ~ linier dengan C, query count tetap, 0 error |
| C2 cari nama melewatkan 50 ms | **Ditolak di 10k** (37 ms p95), tetapi rencana SQL memang buruk | HTTP + EXPLAIN tanpa indeks nama |
| C3 NIK/HP jauh di bawah 50 ms | **Ditolak** | p95 100 / 80 ms; OR memaksa pindai tenant |
| C4 chart tipikal/berat melewatkan 300 ms | **Ditolak di skala ini** (52 / 152 ms), desain tetap salah untuk Q6/Q7 | 14 query, dekripsi semua SOAP, 210 K pada 40 kunjungan |
| C5 jadwal hari ini cepat | **Ditolak** sebelum perbaikan (p95 232 ms); setelah batas bawah 41 ms | EXPLAIN rentang tanpa lower bound; before/after terukur |
| C6 audit 4M membuat Q13 lambat | **Ditolak untuk kueri per-entitas** (p95 22 ms). Diterima sebagai masalah **ukuran/backup** (2,9 GiB, belum partisi) | EXPLAIN index range + HTTP |
| C7 isolasi pencarian antar penyewa | **Diterima** | NIK identik, id berbeda, halaman nama disjoin |
| C8 JPEG-XL + selubung | **Diterima dengan catatan** (encode periapikal JXL > J2K, tetap < 1 s) | `imaging.json` |

## 10. Lima bottleneck teratas dan usulan (diurut dari bukti)

1. **`php artisan serve` / `php -S` sebagai server demo/SaaS.** p95 di C=50 mencapai 1–10 s meski query kecil. *Perbaikan:* FrankenPHP atau php-fpm/Octane di lingkungan yang menyerupai produksi sebelum menolak/menyetujui kapasitas 10k untuk banyak kursi kerja. Angka ini tidak boleh dipakai untuk memilih pemenang server produksi (belum diukur).
2. **Jadwal hari ini memindai seluruh sejarah kursi.** Satu baris hilang: batas bawah `starts_at`. *Perbaikan (sudah diprototipe di cabang ini, terukur 187 → 41 ms):* `where starts_at >= awal_hari - 1 hari AND starts_at < akhir_hari AND ends_at > awal_hari`. Layak dibawa ke `main` setelah tinjauan (perilaku overlap janji lintas hari tetap terjaga dengan jendela −1 hari).
3. **`PatientSearch` memakai `OR` pada `nik_bidx`/`phone_bidx`, dan LIKE nama kalah dari indeks `created_at`.** NIK/HP sudah melewatkan 50 ms di 10k pasien. *Perbaikan:* dua lookup kesetaraan (atau `UNION`), jangan `OR`; untuk nama, pertimbangkan urutan yang memungkinkan indeks prefiks, atau percepat pindah ke `search_patient` di PostgreSQL (A10). Prioritas sekarang: perbaiki NIK/HP.
4. **`GET /api/patients/{id}/chart` memuat semua kunjungan + mendekripsi setiap versi SOAP.** 52 ms / 20 K (12 kunjungan) dan 152 ms / 210 K (40) masih di bawah 300 ms, tetapi Q6 meminta halaman pertama 20 kunjungan dan Q7 adalah kueri permukaan-terkini, bukan muat-semua. *Perbaikan:* paginasi kunjungan, jangan kirim badan SOAP di daftar versi (lazy-load), odontogram terkini di SQL. Kerjakan sebelum plafon kunjungan naik.
5. **Daftar invoice tanpa indeks `(tenant_id, branch_id, created_at, id)`** — ~92 ms untuk 50 baris setelah pindai tenant. *Perbaikan:* indeks itu (plus keyset, bukan filesort). Sekunder: `upload_max_filesize` produksi ≥ ukuran asli pano lossless (~2,4–4 MiB terkompresi, lebih besar jika belum dikompresi); partisi/`purge` audit adalah isu retensi/backup, bukan latensi Q13 di akses per-entitas.

Tidak masuk lima besar (dan ini disengaja setelah A5): object storage / tier dingin rontgen (D-047 tetap opsional). 100 berkas/klinik/tahun tidak mendominasi; `audit_event` 2,9 GiB/penyewa di 10k pasien yang mendominasi penyimpanan.

## 11. Yang tidak diukur / batasan

- Bukan PostgreSQL 18 + RLS; target §7.2 ditulis untuk rencana PG. Perbandingan ini adalah **pelabuhan MySQL MVP**, plus jatuh-tempo ke target yang sama.
- Bukan server aplikasi produksi; bukan klien di jaringan publik (semua 127.0.0.1).
- Satu run per titik HTTP (bukan ≥5 ulangan kecuali follow-up jadwal/citra/invoice). Satu run adalah perkiraan; error dihitung (0 pada jalur utama) dan isi respons dicek.
- Sebaran kunjungan tidak merata sepanjang 10 tahun (§4).
- Proksi 4 worker buatan gagal; C1 tidak diuji ulang di multi-proses.
- Modul `file_object` belum ada di `main`; unggah/buka citra = prototipe `/api/bench/images` (hanya jika `BENCH_ENDPOINTS=true`).
- Resep di-seed sebagai draf (trigger “resep sudah dikunci”).
- Tidak ada data pasien asli di seed, tes, atau berkas citra.

## 12. Cara mengulang

```bash
# app/backend .env: APP_ENV=local, DB_DATABASE=ehr_bench, DEV_QUICK_LOGIN=true, BENCH_ENDPOINTS=true
php artisan bench:seed --fresh --tenants=1 --patients=10000 --years=10 --chairs=5 --label=A
php artisan bench:seed --append --tenants=10 --patients=2000 --years=1 --chairs=3 --label=B
php artisan serve --host=127.0.0.1 --port=8001
python3 tools/bench/imaging_bench.py
python3 tools/bench/http_load.py --base http://127.0.0.1:8001 \
  --manifest app/backend/database/bench/out/manifest-A.json
```

Skrip pendukung: `tools/bench/`. Jangan pernah mengarahkan seeder ke `ehr_dev` / `ehr_test`.
