# EHR Gigi — backend (Laravel 13 API, MySQL 8.4 mode)

Prototipe. **Hanya data palsu.** MySQL tidak punya RLS, jadi data pasien asli dilarang di mode ini (D-030);
target sebelum data asli = PostgreSQL + RLS (lihat "Pindah ke PostgreSQL").

## Menjalankan

```sh
export PATH=/opt/php84/bin:$PATH
/home/box/mysql84/start.sh                                   # kalau MySQL 127.0.0.1:3306 belum jalan
cd app/backend
composer dev:reset                                           # = php artisan dev:reset: migrate:fresh sebagai ehr_admin + grant + trigger + seed, cetak akun dev
                                                             #   (hanya APP_ENV=local dan DB ehr_dev/ehr_test; selain itu menolak)
composer dev                                                 # backend :8000 + frontend :5173, keduanya 127.0.0.1 (../dev.sh)
php artisan serve --host=127.0.0.1 --port=8000               # atau backend saja; berjalan sebagai ehr_app
php artisan test                                             # ehr_test: migrate fresh sebagai ehr_admin, tes sebagai ehr_app
vendor/bin/pint --test
```

Koneksi: `mysql` = `ehr_app` (runtime, hanya SELECT/INSERT/UPDATE per tabel, DELETE hanya di tabel framework),
`mysql_admin` = `ehr_admin` (migrasi/seed/setup tes saja). Migrasi khusus MySQL (grant, trigger, indeks prefiks)
ada di `database/migrations/mysql/` dan hanya dimuat bila driver = mysql. Draf PostgreSQL ada di `database/postgres-target/` (tidak dijalankan).

## Modul

Kode ada di `app/Modules/<Modul>` (Routes/routes.php dimuat oleh `<Modul>ServiceProvider` di bawah `/api`, Models, Http, Services,
Domain, Contracts) + kernel bersama `app/Shared`. Daftar modul & sisi (edge) yang boleh: **`config/modules.php`** (provider didaftarkan dari sini).
Aturan (dicek `tests/Feature/ModuleBoundaryTest`, memindai semua referensi `App\Modules\...`, termasuk `use`): modul boleh memakai `App\Shared`;
modul lain **hanya** lewat `Contracts\` atau `Events\`-nya dan hanya bila sisinya tercantum; `App\Shared` tidak memakai modul; tidak ada yang bergantung pada Reporting.
Implementasi kontrak di-bind lewat `$bindings` provider modul. Tes per modul di `tests/Modules/<Modul>`; tes lintas modul (arsitektur, batas modul,
user DB, matriks izin) di `tests/Feature`. Migrasi tetap di `database/migrations` (+ `mysql/`); header tiap file menyebut modul pemiliknya.

| Modul | Memiliki | Boleh bergantung pada (Contracts/Events) |
|---|---|---|
| Shared (kernel) | `Ctx` + `BelongsToTenant`, `Audit` + `audit_event`/`auth_event`, `Crypto` (enkripsi + blind index), `Permissions`, `Controller`, middleware `NoStore`/`RequirePermission`, `ModuleServiceProvider` | — (tidak memakai modul) |
| Tenancy | `tenant`, `branch`, `membership`; middleware `TenantContext`; `/api/me`, `/api/session/branch`; kontrak `TenancyDirectory` | — |
| Identity | `users`, login Fortify + TOTP wajib, `EnsureTwoFactor`, `NoRememberMe`, masuk cepat dev; kontrak `UserDirectory` | — |
| Patients | `patient`, `household`, `guardian`, `medical_history_version` (berversi), `/api/patients*` (keluarga, wali, riwayat medis, peringatan), `PatientSearch`; kontrak `PatientDirectory` | Tenancy |
| Scheduling | `chair`, `appointment` (+ waktu datang/duduk/selesai), `planned_appointment`, state machine, cek double booking (buat, ubah jadwal, dari rencana), `/api/schedule`, `/api/appointments*`, `/api/planned-appointments*` | Tenancy, Patients, Identity |
| Clinical | `visit`, `clinical_note(_version)`, `tooth_finding`, `correction_request`, rekam medis (chart, odontogram, SOAP, tanda tangan, koreksi), status tindakan (`Domain\ProcedureStatus`), `tooth_baseline`, `consent_record`; `Contracts\VisitDirectory`, `Contracts\IntegrityFacts` (laporan pemilik), `Events\ProcedureRecorded` (tanpa harga, dikirim untuk tindakan `selesai`) | Patients, Scheduling, Tenancy, Identity, Integrations |
| Integrations | `outbox` + kontrak `OutboxPublisher` (belum ada pengirim) | — |
| Intake | stub. Akan: anamnesis/kuesioner pra-kunjungan berversi; peringatan medis lewat kontrak `Patients\Contracts\MedicalAlerts` | Patients |
| Queue | stub. Akan: antrean cabang (`menunggu → dipanggil → di_kursi → selesai`, `batal`) | Scheduling |
| Prescriptions | `prescription`, `prescription_item` (`kfa_code` + dosis terenkripsi), `prescription_void` (U0c: tabel + trigger, belum ada API). MVP = resep cetak ditandatangani dokter di kertas; `signed` tak bisa diubah, koreksi = batal + terbit ulang nomor baru; belum kirim SATUSEHAT (D-036) | Patients, Clinical |
| Tariffs | `tariff` (kode + tingkat kesulitan `variant`/`level_label`/`level_rank`, `valid_from`/`valid_to`, harga palsu), templat tingkat `Domain\DifficultyTemplate` di-seed per tenant, `PUT /api/tariffs/{id}/levels` (pemilik, versi baru bertanggal, diaudit); kontrak `PriceLookup` | — |
| Billing | `invoice`, `invoice_line` (dibuat listener dari `Clinical\Events\ProcedureRecorded` + snapshot `PriceLookup`), `invoice_adjustment` (append-only); dokter tidak pernah mengetik harga; kontrak `FinalizedRevenue` (stub), `IntegrityFacts` (laporan pemilik) | Clinical, Tariffs, Patients, Tenancy |
| Compensation | `Domain\CompensationBasis` (default `after_material_and_lab`, alternatif `before_costs`, D-034), kontrak stub `FeeCalculator` (aturan bertanggal, periode lewat tidak dihitung ulang); belum ada tabel/API | Billing (hanya `Contracts\`), Identity |
| Recall | `reminder_log` + `ReminderService` (pengingat janji, kanal no-op) | Scheduling |
| Audit | `GET /api/audit-events` (pemilik, baca saja; tanpa API ubah/hapus), unit 6 | Identity, Tenancy |
| Reporting | laporan integritas pemilik per dokter + peringatan `GET /api/reports/integrity` (`reporting.read`), unit 6; hanya lewat Contracts | Clinical, Billing, Scheduling, Identity, Patients, Tenancy (tidak ada yang boleh memakai Reporting) |
| Inventory | stub: README + provider kosong | — |

Aturan harga (tes `test_pricing_and_reporting_edges`): Clinical tidak punya jalur (langsung/transitif) ke Billing atau Tariffs, Compensation membaca Billing hanya lewat `Contracts\`, tidak ada yang bergantung pada Reporting.
Kontrak stub tanpa implementasi/binding: `Billing\FinalizedRevenue`, `Patients\MedicalAlerts`, `Compensation\FeeCalculator`. (C3 mengimplementasikan `Tariffs\PriceLookup`, `Clinical\VisitDirectory` dan mengirim `ProcedureRecorded`.)

## Referensi ICD (data resmi, bukan sintetis)

Tabel global `icd10_codes` dan `icd9cm_codes` (tanpa `tenant_id`; `ehr_app` hanya SELECT). Isi = daftar resmi SATUSEHAT:
ICD-10 versi `ICD10_2010` (18542 kode) dan ICD-9-CM versi `ICD9CM_2010` (4626 kode). `display` = teks resmi **bahasa Inggris**;
dokumen resmi tidak punya judul bahasa Indonesia, jadi tidak ada terjemahan. **K02.5 tidak ada** di versi ini (kode WHO 2019).
Sumber, URL unduhan, dan SHA-256: `database/data/icd/SOURCE.md` (CSV di folder itu = ekspor apa adanya dari xlsx resmi).

```sh
php artisan icd:import                                       # dari CSV lokal database/data/icd (default; juga dipanggil DatabaseSeeder)
php artisan icd:import --source=file --path=tests/fixtures/icd   # berkas/folder CSV lain (kolom code,display,version)
php artisan icd:import --source=satusehat                    # API FHIR SATUSEHAT (OAuth2; butuh SATUSEHAT_* di .env)
php artisan icd:import --source=satusehat --fallback=spreadsheet # sama, tapi pakai spreadsheet bila API tidak memberi daftar
php artisan icd:import --source=satusehat-spreadsheet        # unduh spreadsheet publik resmi (Google Sheets export, tanpa kredensial)
```

Ditulis sebagai `ehr_admin` (`mysql_admin`), idempoten: upsert per `code`; kode yang hilang dari sumber jadi `valid=false`
(tidak dihapus, catatan lama mungkin memakainya), kode yang muncul lagi jadi valid. Production butuh `--force`.
Pencarian: `App\Shared\Terminology\IcdCatalog` (hanya `valid=true`).

`--source=satusehat` (`SatusehatApiSource`): token `POST {base}/oauth2/v1/accesstoken?grant_type=client_credentials` (form
`client_id`, `client_secret`), lalu Bearer ke `{base}/fhir-r4/v1`: `ValueSet/$expand?url=` lalu `CodeSystem?url=` untuk
`http://hl7.org/fhir/sid/icd-10` dan `.../icd-9-cm`. **Per 15 Nov 2026 katalog API resmi tidak mendokumentasikan unduhan daftar ICD
lengkap lewat API** (CodeSystem/ValueSet tidak tercantum); bila server tidak menjawab, perintah gagal tanpa menulis apa pun dan menyarankan
`--source=satusehat-spreadsheet` (daftar lengkap resmi). Isi `.env`: `SATUSEHAT_ENV` (`sandbox`|`production`), `SATUSEHAT_CLIENT_ID`,
`SATUSEHAT_CLIENT_SECRET`, `SATUSEHAT_ORG_ID` (wajib walau belum dikirim; satu client_id = satu organisasi). Cara mendapat kredensial
sandbox & detail: `database/data/icd/SOURCE.md`. Tes hanya memakai `Http::fake` (tanpa kredensial asli).

## Masuk cepat (DEV SAJA)

`POST /dev/quick-login {user_email}` masuk **tanpa TOTP**, plus `GET /api/dev/status` (daftar akun seed untuk pemilih di layar login).
Rute hanya **didaftarkan** bila `APP_ENV=local` **dan** `DEV_QUICK_LOGIN=true` (`config('ehr.dev_quick_login')`); selain itu 404 (controller mengecek ulang).
Hanya akun yang ada dengan email pola `*@*.test`; tiap pemakaian dicatat di `auth_event` (`dev_quick_login`) dan sesi ditandai `dev_quick_login`.
Login normal tetap wajib TOTP. Jangan pernah set `DEV_QUICK_LOGIN` di luar mesin dev.

## Akun dev (sintetis)

Kata sandi semua akun: `rahasia-dev-123`. TOTP secret semua akun: `JBSWY3DPEHPK3PXP` (contoh umum, dev saja).
Kode saat ini: `php artisan dev:totp dokter@senyum.test` (menolak jalan bila `APP_ENV=production`).

| Email | Klinik | Peran |
|---|---|---|
| pemilik@senyum.test | Klinik Gigi Senyum Sehat (2 cabang Jakarta) | owner (semua cabang) |
| dokter@senyum.test | Senyum Sehat | dentist (semua cabang) |
| asisten@senyum.test | Senyum Sehat | assistant (cabang Kemang) |
| depan@senyum.test | Senyum Sehat | front_desk (cabang Kemang) |
| kasir@senyum.test | Senyum Sehat | kasir (cabang Kemang) |
| kasir@ceria.test | Klinik Gigi Ceria (Bandung) | kasir |
| dokter@ceria.test | Klinik Gigi Ceria (Bandung) | owner + dentist |

Seed: 40 pasien per klinik (NIK awalan `99`, HP `0899…`), janji hari ini + besok (Asia/Jakarta). Pasien pertama Senyum Sehat: kunjungan -5 hari (catatan dikoreksi v1→v2),
-2 hari (catatan bertanda tangan + temuan final), dan kunjungan hari ini dari janji pertamanya (draf SOAP + draf odontogram, satu temuan `ai_draft`).

## Alur login (SPA, cookie Sanctum)

`GET /sanctum/csrf-cookie` → `POST /login` (`{two_factor:true}`) → `POST /two-factor-challenge {code}` (204) → `GET /api/me`.
TOTP wajib untuk semua peran: user tanpa 2FA terkonfirmasi mendapat `403 two_factor_required` di semua `/api/*`;
hanya rute Fortify `/user/confirm-password`, `/user/two-factor-*` dan `/logout` yang terbuka. "Remember me" diabaikan.
Rate limit: login 5/menit per email+IP, 2FA 5/menit per sesi+IP. Semua respons API: `Cache-Control: no-store`.

API: `GET /api/me`, `POST /api/session/branch`, `GET|POST /api/patients` (`?q=`, `?cursor=`), `GET /api/patients/{id}`,
`GET /api/schedule?branch_id&date`, `POST /api/appointments`, `POST /api/appointments/{id}/transition {to}`.
C3: `GET|PUT /api/patients/{id}/family`, `POST /api/patients/{id}/guardians`, `GET|PUT /api/patients/{id}/medical-history`, `GET /api/patients/{id}/alerts`,
`GET|PUT /api/patients/{id}/baseline`, `POST /api/patients/{id}/consents`, `POST /api/findings/{id}/status {to, visit_id?}`, `POST /api/appointments/{id}/reschedule`,
`POST /api/patients/{id}/planned-appointments`, `GET /api/planned-appointments?branch_id`, `POST /api/planned-appointments/{id}/schedule`,
`GET /api/visits/{id}/invoice`, `GET /api/invoices/{id}`, `POST /api/invoices/{id}/adjustments`; `php artisan recall:send-reminders` (kanal no-op).
U0c: `PUT /api/tariffs/{id}/levels` (pemilik).
Rekam medis (Clinical): `GET /api/patients/{id}/chart`, `POST /api/appointments/{id}/visit` (idempoten), `POST /api/visits/{id}/findings`,
`PATCH|DELETE /api/findings/{id}` (draf milik sendiri), `PUT /api/visits/{id}/note {revision, soap}` (409 bila basi/ditandatangani),
`POST /api/visits/{id}/sign {revision, confirm: true, code}` (dokter gigi penulis + TOTP baru, selain itu 403), `POST /api/notes/{id}/corrections {reason, soap}`
(≤48 jam langsung; >48 jam: praktik satu dokter = setujui sendiri, selain itu `correction_request` → `POST /api/correction-requests/{id}/approve` oleh pemilik).
Izin: satu matriks di `app/Shared/Permissions/Permissions.php`; ditolak = 403 + baris `audit_event` (`akses_ditolak`).

## Model isolasi mode MySQL

- Tidak ada RLS. Tembok tenant = trait `App\Shared\Tenancy\BelongsToTenant`: global scope `tenant_id = konteks`,
  isi `tenant_id` saat create (tenant lain = ditolak), **tanpa konteks = exception** (bukan semua baris).
- Konteks (`App\Shared\Tenancy\Ctx`) = binding `scoped` (reset tiap request/job). Di Octane **harus** tetap scoped, jangan static.
  Diisi hanya oleh middleware `TenantContext` (`App\Modules\Tenancy\Http\Middleware`) dari membership milik user + pilihan di sesi, tidak pernah dari body request.
  Job antrean wajib memakai `Ctx::runAs($tenantId, fn () => ...)`.
- Satu-satunya pengecualian: `Membership` boleh di-query tanpa tenant, tetapi hanya baris `user_id = user yang login`.
- `tests/Feature/ArchitectureTest`: setiap model (di `app/Modules` + `app/Shared`) bertabel `tenant_id` wajib memakai trait; `app/` dilarang memakai
  `withoutGlobalScope(s)`, `DB::table/select/...`, `*Raw(` (allowlist kosong; scanner diuji dengan potongan kode yang salah).
- Lapis kedua: FK komposit `(tenant_id, x_id)` → `(tenant_id, id)`, PK `(tenant_id, id)`; ehr_app tanpa DROP/ALTER/DELETE
  (jadi tanpa TRUNCATE); trigger menolak UPDATE/DELETE pada versi catatan bertanda tangan, temuan gigi final, audit.
- Double booking: tanpa exclusion constraint; transaksi + `lockForUpdate()` pada baris kursi, cek tumpang tindih, 409.

## Kunci

NIK/HP/alamat/teks klinis dienkripsi per kolom dengan `ENCRYPTION_KEY` (AES-256-GCM, terpisah dari `APP_KEY`);
NIK/HP juga punya blind index HMAC-SHA256 dengan `BLIND_INDEX_KEY`. Satu kunci per deployment dari env = **shortcut prototipe**:
produksi butuh KMS (kunci dibungkus), kunci per tenant, dan rotasi (re-enkripsi + versi kunci di ciphertext).
Rahasia TOTP Fortify dienkripsi dengan `APP_KEY`.

## Pindah ke PostgreSQL (checklist)

1. Jalankan `database/postgres-target/` (peran `ehr_owner`/`ehr_app`, ekstensi, skema dengan enum + CHECK).
2. RLS: `ENABLE` + `FORCE ROW LEVEL SECURITY` di setiap tabel tenant, policy `tenant_id = current_setting('app.tenant_id')::uuid`; view `security_invoker`.
3. Middleware `TenantContext`: buka transaksi per request + `select set_config('app.tenant_id', ?, true)` (parameter terikat, transaction-local; jangan `SET`/`false`). Job antrean: transaksi + set_config sendiri. Trait `BelongsToTenant` tetap (pertahanan berlapis).
4. Double booking: ganti cek PHP + `lockForUpdate` dengan `EXCLUDE USING gist (tenant_id WITH =, chair_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` (+ dokter), tangkap 23P01 → 409.
5. Pencarian: ganti isi `App\Modules\Patients\Services\PatientSearch` dengan fungsi `search_patient()` (trigram GIN, `postgres-target/0004`); indeks trigram tidak terpakai langsung di bawah RLS.
6. Trigger append-only → plpgsql (`clinical_note_version_guard`, `reject_change`, `BEFORE TRUNCATE`); grant: pemilik tabel bukan superuser, ehr_app tanpa DELETE/TRUNCATE.
7. Ganti `database/migrations/mysql/` dengan padanan PG (setiap file mencantumkan padanannya); `audit_event` dipartisi per bulan.
8. Ulangi semua tes + `EXPLAIN (ANALYZE, BUFFERS)` dengan RLS aktif sebelum klaim kecepatan.
