# Staging di Hostinger (inspidok.com)

**Hanya staging, DATA SINTETIS SAJA (D-030).** Tidak ada data pasien asli, NIK asli, atau nomor HP asli. Penyimpangan untuk staging ini dicatat di `app/DEVIATIONS.md` #59.

## 1. Kenapa hosting bersama, dan batasnya

- Yohanes memilih Hostinger Cloud (hosting bersama) untuk **staging/demo** di `https://inspidok.com` karena sudah tersedia. Laravel Cloud tetap alternatif (`docs/deploy/staging.md`).
- Batas lingkungan: CloudLinux + LiteSpeed (`.htaccess`), PHP 8.4 di `/opt/alt/php84/usr/bin/php`, **tanpa root, tanpa Docker, SSH tidak diasumsikan**, **satu akun database** (ALL pada DB-nya, tanpa GRANT OPTION; tidak bisa `CREATE USER`/`GRANT`), document root tetap `/home/u131761927/domains/inspidok.com/public_html`.
- Akibatnya aplikasi dijalankan dalam **mode satu akun DB** (`DB_APP_GRANTS=false`), lihat bagian 4.

## 2. Tata letak

- Isi arsip diekstrak ke `public_html`, jadi **`public_html` = akar Laravel** (`artisan`, `app/`, `vendor/`, `public/`, …).
- `public_html/.htaccess` (sumber: `app/deploy/hostinger/root.htaccess`) menulis ulang **setiap** permintaan ke `public/`. Tidak ada berkas di luar `public/` yang bisa diakses dari web. Lapisan tambahan: dotfile (`.env`, `.git*`) dan berkas sensitif (`composer.*`, `artisan`, `*.zip`, `*.sql`, `*.log`) ditolak, daftar direktori mati, dan tanpa `mod_rewrite` semua ditolak (gagal tertutup).
- `public/.htaccess` (bawaan Laravel) lalu meneruskan ke `public/index.php`. SPA ada di `public/client` dan disajikan di `/`.

## 3. PHP 8.4 dan ekstensi

Pilih PHP **8.4** di hPanel (Advanced → PHP Configuration). Ekstensi yang dibutuhkan Laravel 13 + aplikasi ini: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `curl`, `zip`, `intl`, `sodium` (enkripsi kolom). **Perlu dicek** di panel bahwa semuanya aktif (biasanya aktif secara bawaan). `proc_open` dibutuhkan `schedule:run` untuk menjalankan perintah terjadwal; **perlu dicek** tidak dimatikan.

## 4. Satu akun database (penyimpangan staging)

- `DB_APP_GRANTS=false`: migrasi di `database/migrations/mysql` **melewati GRANT** (akun tidak boleh GRANT). Trigger append-only (catatan bertanda tangan, odontogram final, audit, tagihan, dll.) dan indeks **tetap dibuat**.
- `DB_ADMIN_USERNAME` dan `DB_ADMIN_PASSWORD` **dikosongkan**: koneksi `mysql_admin` (migrasi/seed) memakai akun yang sama dengan `DB_USERNAME`/`DB_PASSWORD`.
- Yang hilang: **pemisahan hak** (`ehr_app` tanpa DROP/TRUNCATE/ALTER/DELETE). Aplikasi berjalan dengan akun yang bisa mengubah skema dan menghapus data. Trigger tetap menolak UPDATE/DELETE pada catatan append-only, tetapi akun ini juga bisa `DROP TRIGGER`. Ini diterima **hanya untuk staging data palsu** (DEVIATIONS #59); tidak boleh dipakai dengan data asli.
- **Perlu dicek:** bila binary log MySQL Hostinger aktif, `CREATE TRIGGER` bisa butuh hak `SUPER` atau `log_bin_trust_function_creators=1`. Bila migrasi gagal di trigger, **berhenti dan laporkan**; jangan hapus trigger dari migrasi.

## 5. Variabel lingkungan (`.env`)

Mulai dari `app/backend/.env.staging.example`. Isi minimal:

| Kunci | Nilai |
|---|---|
| `APP_ENV` | `staging` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | `php artisan key:generate --show` (di komputer sendiri) |
| `APP_URL` | `https://inspidok.com` |
| `SANCTUM_STATEFUL_DOMAINS` | `inspidok.com` |
| `FRONTEND_ORIGINS` | `https://inspidok.com` |
| `DB_HOST` | `localhost` |
| `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | dari hPanel → Databases (akun satu-satunya) |
| `DB_ADMIN_USERNAME`, `DB_ADMIN_PASSWORD` | **kosong** (pakai akun yang sama) |
| `DB_APP_GRANTS` | `false` |
| `ENCRYPTION_KEY`, `BLIND_INDEX_KEY` | masing-masing `base64:` + 32 byte acak (lihat templat) |
| `LOG_CHANNEL` | `daily` (berkas di `storage/logs`, tidak bisa diakses dari web) |
| `QUEUE_CONNECTION` | `database` |
| `QUEUE_VIA_SCHEDULER` | `true` (antrean dijalankan dari scheduler; satu baris cron) |
| `CACHE_STORE`, `SESSION_DRIVER` | `database` |
| `FORCE_HTTPS` | `true` |
| `TRUSTED_PROXIES` | **kosong** bila LiteSpeed menerima klien langsung. Isi hanya bila ada proxy/CDN di depan (mis. CDN Hostinger), dengan alamat proxy itu; **perlu dicek** bila muncul loop redirect HTTPS. |
| `STAGING_DEMO_PASSWORD` | acak, min. 16 karakter: `openssl rand -base64 24` |
| `STAGING_DEMO_TOTP_SECRET` | base32 min. 16 karakter: `head -c 20 /dev/urandom \| base32` |
| `DEV_QUICK_LOGIN` | `false` |

Simpan berkas `.env` ini **di luar repo** (mis. pengelola sandi + berkas lokal terenkripsi). Kunci enkripsi yang hilang = data terenkripsi tidak terbaca.

## 6. Build dan deploy

Di komputer dev (bukan di server):

```sh
export PATH=/opt/php84/bin:$PATH            # PHP 8.4 + composer + node
ENV_FILE=/jalur/aman/inspidok.env app/scripts/build-hostinger-archive.sh /tmp
# -> /tmp/bittodent-staging_YYYYMMDD_HHMMSS.zip
```

Skrip memakai `git archive HEAD` (perubahan yang belum di-commit **tidak** ikut), `composer install --no-dev --classmap-authoritative`, membangun SPA ke `public/client`, membuang `tests/`, `phpunit.xml`, `Dockerfile`, `.env*` dari repo, isi `storage/logs` dan cache, lalu menambah `.htaccess` root. `SKIP_NPM_CI=1` memakai `app/frontend/node_modules` yang sudah ada. `PHP_BIN` memilih biner PHP 8.4.

Unggah arsip ke Hostinger dan ekstrak ke `public_html` (alat deploy arsip Hostinger, atau hPanel File Manager → unggah → Extract). **Setiap deploy menimpa `public_html`, termasuk `.env`**, jadi `ENV_FILE` wajib diberikan **setiap kali** build; tanpa itu skrip memberi peringatan dan arsip tidak berisi `.env`.

## 7. Migrasi dan seed sekali jalan (cron sementara)

Tanpa SSH, jalankan lewat **cron sementara** di hPanel (Advanced → Cron Jobs), lalu **hapus** setelah selesai:

```sh
cd /home/u131761927/domains/inspidok.com/public_html && /opt/alt/php84/usr/bin/php artisan migrate --database=mysql_admin --force >> storage/logs/deploy.log 2>&1
```

Setelah migrasi pertama berhasil (cek `storage/logs/deploy.log` lewat File Manager), ganti dengan seed sekali:

```sh
cd /home/u131761927/domains/inspidok.com/public_html && /opt/alt/php84/usr/bin/php artisan staging:seed >> storage/logs/deploy.log 2>&1
```

`staging:seed` menolak bila `STAGING_DEMO_PASSWORD`/`STAGING_DEMO_TOTP_SECRET` kosong, terlalu pendek, atau sama dengan nilai dev publik; menolak bila data sudah ada; dan **tidak pernah mencetak** kata sandi atau TOTP secret (hanya email/nama akun). Login demo: email `*.test` dari log, kata sandi = `STAGING_DEMO_PASSWORD`, tambahkan `STAGING_DEMO_TOTP_SECRET` ke aplikasi authenticator. Hapus cron sementara itu. Deploy berikutnya yang membawa migrasi baru: ulangi hanya cron migrasi.

## 8. Cron tetap

Dengan `QUEUE_VIA_SCHEDULER=true` cukup **satu** baris (scheduler menjalankan `recall:send-reminders` tiap 15 menit dan `queue:work --stop-when-empty --max-time=50 --tries=3` tiap menit, tanpa tumpang tindih):

```
* * * * * /opt/alt/php84/usr/bin/php /home/u131761927/domains/inspidok.com/public_html/artisan schedule:run >> /dev/null 2>&1
```

Alternatif bila `QUEUE_VIA_SCHEDULER=false`: tambahkan baris kedua untuk antrean.

```
* * * * * /opt/alt/php84/usr/bin/php /home/u131761927/domains/inspidok.com/public_html/artisan queue:work --stop-when-empty --max-time=50 --tries=3 >> /dev/null 2>&1
```

## 9. Verifikasi

```sh
curl -sI https://inspidok.com/up                # 200
curl -s  https://inspidok.com/ready             # {"status":"ok"} (DB tersambung)
curl -sI https://inspidok.com/                  # 200, X-Frame-Options: DENY, Content-Security-Policy, Strict-Transport-Security
curl -sI http://inspidok.com/                   # 301 ke https
curl -sI https://inspidok.com/.env              # 403/404, BUKAN isi berkas
curl -sI https://inspidok.com/composer.json     # 404 (diteruskan ke public/, tidak ada di sana)
curl -sI https://inspidok.com/storage/logs/     # 404
```

Lalu login `pemilik@senyum.test` dengan kredensial demo + kode TOTP.

## 10. Risiko: BUKAN untuk data pasien asli

- Server dipakai bersama (~15 situs lain di akun yang sama), tanpa root, tanpa kontrol isolasi atau patch OS.
- Tanpa pemisahan hak database (bagian 4); satu kebocoran kredensial = kendali penuh atas skema dan data.
- Belum ada kebijakan cadangan/restore yang diuji, belum ada enkripsi cadangan, belum ada pemantauan.
- Lokasi pusat data akun ini **perlu dicek**; data kesehatan tunduk pada UU 27/2022 (PDP) dan Permenkes rekam medis (nomor & pasal perlu dicek), serta aturan proyek "data & backup tetap di Indonesia".
- **Produksi** (data asli) butuh VPS/server khusus di Indonesia dengan dua akun DB (`ehr_admin` + `ehr_app`), lalu PostgreSQL 18 + RLS sebelum data asli (gerbang keras, D-030).

## 11. Status deploy pertama (15 Nov 2026)

- Website `inspidok.com` dibuat di order Cloud `1006813012` (akun `u131761927`), PHP **8.4.27** (+ `sodium`, `expose_php=Off`), SSL Hostinger aktif (lifetime) dengan redirect HTTPS dan CDN Hostinger di depan.
- Database `u131761927_bittostg`, server **MariaDB 11.8** (bukan MySQL 8.4). Semua 38 migrasi jalan dengan driver `mysql`, termasuk trigger append-only (tidak ada galat SUPER/binlog); GRANT dilewati (`DB_APP_GRANTS=false`). Sebelumnya diuji lokal di MariaDB 11.8.3: bila binlog aktif tanpa `log_bin_trust_function_creators`, `CREATE TRIGGER` gagal (1419), jadi cek ini lagi bila server pindah.
- Tidak ada SSH yang dipakai; tidak ada `composer`/`node` di server, jadi `vendor/` dan SPA ikut dalam arsip. Migrasi + `staging:seed` dijalankan lewat cron sementara lalu dihapus. Perintah cron hPanel dibatasi **255 karakter**; output dibaca lewat "cron output" hanya bila perintah dibungkus `/bin/bash -c '...'`.
- Cron tetap: satu baris `schedule:run` tiap menit (antrean lewat scheduler).
- Rahasia server (`.env`) tidak ada di repo; disimpan di luar repo pada mesin build dan wajib dikirim lagi lewat `ENV_FILE` setiap deploy (deploy menimpa `public_html`).
- Tampilan masih bermerek "EHR Gigi" karena PR rename Bittodent belum ada di tumpukan ini.
