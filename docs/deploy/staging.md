# Staging Bittodent: runbook

**Hanya staging, DATA SINTETIS SAJA (D-030).** Tidak ada data pasien asli, NIK asli, atau nomor HP asli di staging.
PR yang menambah dokumen ini **tidak melakukan deploy, tidak membuat akun, tidak membayar apa pun, dan tidak di-merge**.
Semua langkah di bawah dilakukan Yohanes nanti, setelah memberi persetujuan.

> **Target staging sekarang: Hostinger (`https://inspidok.com`)**, sesuai keputusan Yohanes. Runbook: `docs/deploy/hostinger.md` (mode satu akun DB, `.htaccess` root ke `public/`, cron). Laravel Cloud di bawah tetap disimpan sebagai **alternatif**.

Riset harga & penyedia (15 Nov 2026): `/workspace/research/staging-hosting.md`. Harga di bawah disalin dari halaman resmi pada tanggal itu; pajak dan pemakaian di atas kuota bisa menambah tagihan. Cek ulang di halaman resmi sebelum membayar.

## 1. Rekomendasi: Laravel Cloud Starter, Singapore

**Laravel Cloud, paket Starter, region Asia Pacific (Singapore) / `ap-southeast-1`.**

Kenapa untuk staging:

- Dukungan resmi Laravel 13, PHP 8.4, MySQL 8.4, antrean terkelola, penjadwal, TLS, domain `*.laravel.cloud`, cadangan harian MySQL, dan lingkungan pratinjau per PR, tanpa merawat server.
- Biaya kecil: Starter **$5/bulan + pemakaian**, **31 hari pertama gratis**, termasuk **kredit pemakaian $5/bulan**. Compute Flex bisa scale-to-zero.
  - https://laravel.com/cloud/pricing
  - https://laravel.com/cloud/docs/pricing
  - https://laravel.com/cloud/docs/free-trial
- Tarif Flex (contoh resmi): 512 MiB $0.00893/jam, 1 GiB $0.01786/jam, 2 GiB $0.03571/jam (dibatasi 28 hari). MySQL Flex 2 GiB nyala terus: 672 jam × $0.03274/jam ≈ $22/bulan; storage dan cadangan tetap ditagih. https://laravel.com/cloud/docs/pricing
- Perkiraan: dipakai sesekali + scale-to-zero ≈ **$5/bulan** setelah masa uji; selalu nyala (demo tanpa jeda bangun) ≈ **$20–35/bulan**. **Pasang spending limit $25/bulan.**
- PHP 8.4: https://laravel.com/cloud/docs/runtimes
- MySQL 8.4: https://laravel.com/cloud/docs/knowledge-base/upgrade-mysql-to-84
- Lingkungan & pratinjau PR (1 aplikasi pratinjau di Starter): https://laravel.com/cloud/docs/environments, https://laravel.com/cloud/docs/preview-environments
- Region (tidak ada Jakarta; terdekat Singapore): https://laravel.com/cloud/docs/applications

Perbandingan singkat:

| Pilihan | Satu baris |
|---|---|
| **Laravel Cloud Starter (disarankan)** | Paling cepat dan native Laravel; ≈ $5/bln untuk staging jarang dipakai; data di Singapore. |
| Forge + VPS | Forge Hobby $12/bln + droplet/VPS (DigitalOcean 2 GiB $12/bln) ≈ $24/bln; kontrol penuh, bisa pindah ke VPS Jakarta untuk produksi; merawat server sendiri. https://laravel.com/forge/pricing, https://www.digitalocean.com/pricing/droplets |
| Railway | Hobby $5/bln (termasuk $5 pemakaian), region Singapore; MySQL plugin (versi 8.4 perlu dicek), antrean/penjadwal dirakit sendiri; ≈ $15–30/bln nyala terus. https://docs.railway.com/pricing |
| Render | Web $7–25/bln + worker; tidak ada MySQL terkelola (hanya Postgres), jadi tidak cocok selama MySQL 8.4 wajib. https://render.com/pricing |

## 2. Lokasi data dan regulasi

- **Staging = data sintetis saja**, jadi Singapore dapat diterima untuk sekarang (penyimpangan dari "data tetap di Indonesia" dicatat di `app/DEVIATIONS.md` #54).
- **Produksi nanti** (rekam medis pasien) harus direncanakan di **Indonesia** (mis. Forge + VPS Jakarta), atau mekanisme transfer UU PDP dipenuhi. Bukan nasihat hukum; perlu ditinjau penasihat.
- UU 27/2022 tentang Pelindungan Data Pribadi (transfer ke luar wilayah Indonesia, Pasal 56; data kesehatan = data pribadi spesifik): https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- PP 71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik (PSE lingkup publik wajib menyimpan di Indonesia, Pasal 20): https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019
- Permenkes 24/2022 tentang Rekam Medis (kerahasiaan, keutuhan, ketersediaan, retensi): https://peraturan.bpk.go.id/Details/245544/permenkes-no-24-tahun-2022

## 3. Yang perlu disiapkan Yohanes

1. Akun Laravel Cloud: https://cloud.laravel.com/signup?plan=starter
2. Kartu pembayaran (wajib walau 31 hari pertama gratis).
3. Koneksi GitHub ke repositori `simbosimbo/Bittodent`.
4. Domain kustom **opsional**; `*.laravel.cloud` cukup untuk staging.
5. **Persetujuan tertulis** sebelum akun dibuat, sebelum kartu dipakai, sebelum deploy pertama, dan sebelum merge ke cabang yang di-deploy.

## 4. Apa yang sudah disiapkan di repo

| Bagian | Letak |
|---|---|
| Templat env staging (tanpa rahasia) | `app/backend/.env.staging.example` |
| Seed sintetis aman (bukan `dev:reset`) | `php artisan staging:seed` (`app/backend/routes/console.php`) |
| HTTPS + header keamanan + proxy tepercaya | `app/backend/app/Shared/Http/Middleware/SecurityHeaders.php`, `config/ehr.php` (`FORCE_HTTPS`, `TRUSTED_PROXIES`) |
| Liveness / readiness | `GET /up` (Laravel), `GET /ready` (cek DB, `{"status":"ok"}` / 503 `{"status":"unavailable"}`, tanpa detail) |
| SPA dari host Laravel (satu origin) | `app/scripts/build-spa-into-backend.sh` → `app/backend/public/client`, disajikan di `/` (`routes/web.php`) |
| Penjadwal | `recall:send-reminders` tiap 15 menit (`routes/console.php`) |
| Container staging-like | `app/docker-compose.yml`, `app/backend/Dockerfile` (php-fpm 8.4), `app/frontend/Dockerfile` (nginx) |
| CI (tanpa deploy) | `.github/workflows/ci.yml` |

`dev:reset`, `dev:totp`, dan `DEV_QUICK_LOGIN` tetap hanya untuk `APP_ENV=local`; jangan nyalakan di staging.

## 5. Langkah Laravel Cloud (dilakukan Yohanes nanti, BUKAN oleh PR ini)

Nama menu di panel bisa berubah; bila tidak sama, ikuti dokumen resmi di atas. Butir bertanda **perlu dicek** belum diverifikasi di panel.

1. **Daftar** paket Starter, masukkan kartu, pasang **spending limit $25/bulan**.
2. **Hubungkan GitHub** dan pilih `simbosimbo/Bittodent`. Cabang lingkungan staging: cabang yang disetujui Yohanes (bukan `main` sebelum merge disetujui).
3. **Aplikasi baru**, region **Asia Pacific (Singapore)**. Direktori aplikasi / root = `app/backend` (**perlu dicek**: dukungan monorepo/subdirektori di panel; bila tidak ada, perintah build harus `cd app/backend` dulu).
4. **Runtime PHP 8.4.**
5. **Database: Laravel MySQL 8.4**, region Singapore. Cloud menyuntikkan `DB_*` satu akun. Aplikasi ini butuh dua peran:
   - `DB_ADMIN_USERNAME` / `DB_ADMIN_PASSWORD` = akun dari Cloud (migrasi + seed).
   - `DB_USERNAME=ehr_app` + `DB_PASSWORD` = akun runtime tanpa hak skema, dibuat sekali lewat konsol SQL: `CREATE USER 'ehr_app'@'%' IDENTIFIED BY '<acak>';` (hak per tabel diberikan migrasi; `DB_APP_GRANT_HOST=%`). **Perlu dicek** apakah akun Cloud boleh `CREATE USER` dan `GRANT`. Bila tidak boleh, jangan menyamakan `ehr_app` dengan akun admin tanpa keputusan baru; laporkan dulu.
6. **Variabel lingkungan** dari `app/backend/.env.staging.example`:
   - `APP_KEY` (Generate / `php artisan key:generate --show`), `ENCRYPTION_KEY` dan `BLIND_INDEX_KEY` masing-masing `base64:` + 32 byte acak (lihat komentar di templat). Simpan juga di pengelola sandi; kunci hilang = data terenkripsi tidak terbaca.
   - `APP_URL=https://<app>.laravel.cloud`, `SANCTUM_STATEFUL_DOMAINS=<app>.laravel.cloud`, `FRONTEND_ORIGINS=https://<app>.laravel.cloud` (satu origin).
   - `STAGING_DEMO_PASSWORD` (min. 16 karakter) dan `STAGING_DEMO_TOTP_SECRET` (base32, min. 16 karakter) untuk akun demo `staging:seed`.
   - `APP_ENV=staging`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `QUEUE_CONNECTION=database`, `CACHE_STORE=database`, `LOG_CHANNEL=stderr`, `FORCE_HTTPS=true`, `TRUSTED_PROXIES=*`, `DEV_QUICK_LOGIN=false`.
   - SATUSEHAT: `SATUSEHAT_ENV=sandbox`, kredensial sandbox saja (opsional).
7. **Perintah build** (membangun SPA dari `app/frontend` lalu menyalinnya ke `public/client`, tanpa menimpa `public/index.php`):
   ```sh
   composer install --no-dev --optimize-autoloader --no-interaction
   bash ../scripts/build-spa-into-backend.sh
   ```
   **Perlu dicek:** build Cloud memuat seluruh repo (agar `../frontend` ada) dan menyediakan Node + npm. SPA memakai rute hash (`/#/pasien`), jadi hanya `/` yang perlu disajikan Laravel; `/client/assets/*` dilayani langsung sebagai berkas statis.
8. **Perintah deploy:**
   ```sh
   php artisan migrate --database=mysql_admin --force
   ```
   Seed **sekali saja** setelah deploy pertama (lewat konsol perintah Cloud), bukan di setiap deploy:
   ```sh
   php artisan staging:seed
   ```
   `staging:seed` hanya jalan bila `APP_ENV=staging`, menolak bila tenant/pengguna sudah ada (kecuali `--force`), selalu menolak bila akun sintetis `*.test` sudah ada, dan tidak pernah jalan di `production`. Kata sandi dan TOTP secret akun `*.test` diambil dari `STAGING_DEMO_PASSWORD` / `STAGING_DEMO_TOTP_SECRET` (wajib, tidak boleh sama dengan nilai dev publik, **tidak dicetak**); tambahkan secret itu ke aplikasi authenticator untuk login 2FA. Jangan pernah dipakai dengan data asli.
9. **Penjadwal**: aktifkan scheduler di compute aplikasi (menjalankan `schedule:run` tiap menit → `recall:send-reminders` tiap 15 menit). Catatan: penjadwal bisa membuat compute tidak tidur; bila biaya naik, matikan saat staging tidak dipakai (**perlu dicek** perilaku scale-to-zero dengan scheduler).
10. **Antrean**: aktifkan worker/queue terkelola (`queue:work`, koneksi `database`). Jangan `QUEUE_CONNECTION=sync`.
11. **TLS**: sudah termasuk untuk `*.laravel.cloud` (dan domain kustom). Aplikasi mengalihkan HTTP→HTTPS dan mengirim HSTS hanya di HTTPS.
12. **Health check**: `/up` (liveness, tanpa DB). `/ready` mengecek DB; jangan dipakai sebagai health check Cloud bila database ikut tidur (bisa membangunkannya terus).
13. **Cadangan**: pastikan cadangan harian MySQL aktif (staging tetap sintetis; cadangan untuk latihan restore).
14. **Satu lingkungan pratinjau** (Starter: 1 aplikasi) untuk PR, dengan env yang sama dan database terpisah.
15. Uji: buka `https://<app>.laravel.cloud/`, login `pemilik@senyum.test` + kode TOTP, cek `https://<app>.laravel.cloud/up` dan `/ready`.

## 6. Cadangan: Forge + VPS (Docker atau PHP biasa)

Forge Hobby **$12/bulan** + droplet/VPS (DigitalOcean Basic 2 GiB **$12/bulan** di `sgp1`, atau VPS Jakarta untuk produksi nanti, mis. Biznet Gio NEO Lite SS 2.1 Rp80.000/bln: https://www.biznetgio.com/en/pricelist). Sumber: https://laravel.com/forge/pricing, https://laravel.com/forge/docs/servers/laravel-vps.

- **PHP biasa (Forge site):** web directory `app/backend/public`, PHP 8.4, MySQL 8.4; buat `ehr_admin` (ALL + GRANT OPTION pada database) dan `ehr_app` seperti `app/docker/mysql/init/01-users.sh`. Env dari `.env.staging.example` (`TRUSTED_PROXIES` kosong bila nginx Forge langsung menerima klien). Deploy script: `composer install --no-dev -o`, `bash ../scripts/build-spa-into-backend.sh`, `php artisan migrate --database=mysql_admin --force`. Daemon: `php artisan queue:work --tries=3 --max-time=3600`. Cron: `* * * * * php artisan schedule:run`. TLS: Let’s Encrypt di Forge.
- **Docker:** `app/docker-compose.yml` (mysql, migrate, backend php-fpm, queue, scheduler, frontend nginx). Pasang terminator TLS di depan nginx, lalu set `FORCE_HTTPS=true`, `SESSION_SECURE_COOKIE=true`, `TRUSTED_PROXIES=<IP proxy>` dan `APP_URL`/`SANCTUM_STATEFUL_DOMAINS`/`FRONTEND_ORIGINS` ke domain https. Lihat bagian Docker di `app/README.md`.

## 7. Bukan cakupan staging ini

- Tidak ada data pasien asli; PostgreSQL 18 + RLS tetap gerbang keras sebelum data asli (D-030).
- Tidak ada deploy otomatis dari CI; `.github/workflows/ci.yml` hanya tes + build.
- Tidak ada klaim kepatuhan (ISO, SATUSEHAT, BPJS).
