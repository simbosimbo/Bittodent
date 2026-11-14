# EHR Gigi — prototipe (Laravel API + React SPA)

**Hanya data sintetis.** Mode MySQL tanpa RLS (D-030): data pasien asli dilarang. Detail backend: `backend/README.md`; penyimpangan: `DEVIATIONS.md`.

## Cara menjalankan

Prasyarat di mesin dev: PHP 8.4 (`/opt/php84/bin`), Node 26 (`/opt/node26/bin`), MySQL 8.4 di `127.0.0.1:3306` (`/home/box/mysql84/start.sh`), Google Chrome di `/usr/bin/google-chrome` (hanya untuk screenshot).

```sh
export PATH=/opt/php84/bin:/opt/node26/bin:$PATH

# 1. Pasang
cd app/backend  && composer install
cd ../frontend  && npm install

# 2. Reset + seed satu perintah (sebagai ehr_admin; MENGHAPUS isi ehr_dev; hanya APP_ENV=local), mencetak akun dev
cd ../backend && composer dev:reset

# 3. Jalankan backend + frontend sekaligus (keduanya hanya di 127.0.0.1; Ctrl+C menghentikan keduanya)
composer dev                            # dari app/backend; sama dengan ./dev.sh dari app/ atau npm run dev:all dari app/frontend
#    atau dua terminal: php artisan serve --host=127.0.0.1 --port=8000  |  cd app/frontend && npm run dev
```

Buka **http://127.0.0.1:5173** (pakai `127.0.0.1`, bukan `localhost`, agar cookie sesi cocok).
Vite meneruskan `/api`, `/login`, `/logout`, `/two-factor-challenge`, `/sanctum`, `/user` ke Laravel, jadi cookie sesi + `XSRF-TOKEN` tetap satu origin.

## Docker (belum diuji di box ini)

Docker tidak terpasang di mesin dev, jadi file ini belum pernah dijalankan. Hanya untuk portabilitas, data palsu saja.

```sh
cd app && cp backend/.env.example backend/.env   # isi APP_KEY, ENCRYPTION_KEY, BLIND_INDEX_KEY
docker compose up --build                        # http://127.0.0.1:8080
docker compose run --rm migrate php artisan db:seed --database=mysql_admin --force   # seed sintetis (opsional)
```

- `mysql` (mysql:8.4, volume `mysql-data`, `127.0.0.1:3307`): `docker/mysql/init/01-users.sh` membuat `ehr_dev`, `ehr_test`, `ehr_admin` (ALL + GRANT OPTION) dan `ehr_app` (tanpa hak) saat volume masih kosong.
- `migrate` (sekali jalan): `php artisan migrate --database=mysql_admin --force`; migrasi memberi hak per tabel ke `'ehr_app'@'%'` (`DB_APP_GRANT_HOST=%`).
- `backend`: `php artisan serve` sebagai `ehr_app`, tidak dipublikasikan ke host.
- `frontend`: build Vite → nginx; meneruskan `/api`, `/login`, `/logout`, `/two-factor-challenge`, `/sanctum`, `/user` ke backend (satu origin untuk cookie).
- Kata sandi DB default (`ehr_admin_dev`, `ehr_app_dev`, `root_dev_only`) hanya placeholder; ganti lewat `EHR_ADMIN_PASSWORD`, `EHR_APP_PASSWORD`, `MYSQL_ROOT_PASSWORD`. Semua port hanya di `127.0.0.1`.

## Tes

```sh
cd app/backend  && php artisan test                    # PHPUnit di MySQL ehr_test
cd app/frontend && npm test && npx tsc --noEmit && npm run build
```

## Screenshot

Butuh backend (seed baru) + frontend dev server yang **sudah jalan**; skrip tidak menyalakan apa pun dan tidak mengunduh browser.

```sh
cd app/backend && composer dev:reset                               # seed baru (butuh DEV_QUICK_LOGIN=true)
php artisan serve --host=127.0.0.1 --port=8000 & (cd ../frontend && npm run dev &)
cd app/frontend && npm run screenshots   # → screenshots/01-login.png … 10-peringatan-medis.png (1440x900)
```

Hasil: 01 login, 02 2FA, 03 jadwal, 04 pasien, 05 pasien baru, 06 odontogram draf, 07 odontogram ditandatangani, 08 dialog konfirmasi tanda tangan SOAP, 09 dialog koreksi (alasan + riwayat v2 "Dikoreksi"), 10 chip peringatan medis + Riwayat Medis.
Skrip login sebagai `depan@senyum.test` dengan TOTP (01–05), lalu sebagai dokter lewat masuk cepat dev dan menandatangani dengan kode TOTP baru (06–10). Fortify menolak kode yang sama dipakai dua kali: tunggu ±30 detik sebelum menjalankan ulang. Skrip mengubah data dev (check-in, tanda tangan); jalankan `composer dev:reset` sebelum mengulang.

## Akun dev (sintetis)

Kata sandi semua akun: `rahasia-dev-123`. TOTP wajib untuk semua peran; secret dev semua akun: `JBSWY3DPEHPK3PXP`.
Kode saat ini: `cd app/backend && php artisan dev:totp <email>` (menolak jalan bila `APP_ENV=production`), atau tambahkan secret itu ke aplikasi autentikator.

**Masuk cepat (dev):** dengan `APP_ENV=local` + `DEV_QUICK_LOGIN=true` di `backend/.env`, layar login menampilkan "Masuk cepat (dev)" (Dokter, Resepsionis, Pemilik, Asisten, Kasir) yang masuk tanpa TOTP. Server yang menentukan: tanpa kedua syarat itu `/api/dev/status` dan `/dev/quick-login` 404 dan tombol tidak muncul. Lihat `backend/README.md`.

| Email | Peran di UI | Cabang |
|---|---|---|
| pemilik@senyum.test | Pemilik | semua cabang Senyum Sehat |
| dokter@senyum.test | Dokter Gigi | semua cabang Senyum Sehat |
| asisten@senyum.test | Asisten (NIK disamarkan, tanpa buat pasien/janji) | Kemang |
| depan@senyum.test | Resepsionis (NIK disamarkan) | Kemang |
| kasir@senyum.test | Kasir (tagihan, pasien & jadwal baca saja, tanpa rekam medis) | Kemang |
| kasir@ceria.test | Kasir | Klinik Gigi Ceria, Bandung |
| dokter@ceria.test | Pemilik, Dokter Gigi | Klinik Gigi Ceria, Bandung |

## Frontend singkat

React 19 + Vite + TypeScript. Kode per modul di `frontend/src/modules/<m>` (`auth`, `patients`, `scheduling`, `clinical`, `billing`; masing-masing `api.ts` + layar + `index.ts` publik) di atas satu klien HTTP `src/shared/api/http.ts` (cookie + XSRF). Modul lain hanya boleh diimpor lewat `index.ts`-nya; `src/shared` tidak mengimpor modul (dicek `src/boundaries.test.ts`). Cangkang A (sidebar, bilah atas dengan pil "Pasien aktif", kartu putih di latar berwarna) di `src/shared/layout/Shell.tsx`; token `src/shared/ui/tokens.css` dibuat dari `design/tokens.json` lewat `npm run tokens` (hasil di-commit agar build Docker tidak butuh folder design). Bilah atas + pita peringatan medis menempel (sticky) saat halaman digulir; sidebar menjadi rel ikon pada lebar ≤1100px. Pasien aktif hanya di memori. Selama ada pasien aktif, pita peringatan (`modules/patients/AlertRibbon.tsx`, dari `GET /api/patients/{id}/alerts`) tampil di semua layar: premedikasi dan catatan penting di depan dan ditonjolkan, lalu alergi, kondisi, obat. Rute hash (`#/pasien`, `#/jadwal`, …) agar tidak bentrok dengan rute Laravel di proxy.
Tidak ada data pasien di `localStorage`/`sessionStorage`, tidak ada service worker; semua data hanya di memori dan respons API `no-store`.
Waktu ditampilkan `id-ID`, zona `Asia/Jakarta` (WIB).
