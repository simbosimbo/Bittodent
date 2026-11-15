# Modul Platform (DEVIATIONS #61)

Superadmin platform (bukan pengguna klinik) yang bisa **masuk sebagai admin klinik** (peran `owner`) untuk membantu setup awal.
Keputusan produk dan risikonya: `app/DEVIATIONS.md` #61.

## Model
- `platform_admins`: entitas terpisah, guard `platform` (bukan `web`, tidak pernah dicek `auth:sanctum`). TOTP wajib (`totp_secret`
  terenkripsi; kosong = tidak bisa login), tanpa remember-me. Izin = kolom JSON `permissions`, saat ini hanya `platform.impersonate`.
  Dibuat hanya lewat seeder bila `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, `PLATFORM_ADMIN_TOTP_SECRET` diisi. Tidak ada endpoint
  untuk membuat/mengubah admin platform; bila dibuat, wajib `not_impersonating`.
- `platform_impersonation`: satu baris per impersonasi (admin, klinik, pengguna target, mulai, selesai, alasan selesai). Sesi hanya
  menyimpan id baris ini. Hanya `ended_at`/`end_reason` yang boleh diisi sekali (trigger MySQL); tidak bisa dihapus.
- `platform_audit_log` (`App\Shared\Audit\PlatformAuditLog`): append-only, metadata saja. Tidak terlihat oleh klinik.

Tabel platform memakai `target_tenant_id`, bukan `tenant_id`: ini bukan tabel tenant (tanpa `BelongsToTenant`).

## Endpoint
| Metode | Path | Catatan |
|---|---|---|
| POST | `/api/platform/login` | `{email, password, code}`; throttle 5/menit; 422 bila salah |
| POST | `/api/platform/logout` | juga mengakhiri impersonasi |
| GET | `/api/platform/me` | profil + `impersonation` aktif/tidak |
| GET | `/api/platform/tenants` | klinik + admin (owner) aktif: `id`, `name`; tanpa data pasien; perlu `platform.impersonate` |
| POST | `/api/platform/impersonate` | `{tenant_id, user_id}`; 403 tanpa izin; 422 bila target bukan owner aktif klinik itu |
| POST | `/api/platform/impersonate/stop` | kembali ke sesi platform; login klinik dibuang |

`GET /api/me` (klinik) menambah `impersonation: {active: false}` atau
`{active: true, platform_admin_name, started_at, blocked_actions: [...]}`.

## Alur
1. Mulai: baris `platform_impersonation` dibuat, login `web` sebagai owner (id sesi diganti), sesi `tenant_id` = klinik target.
2. Tiap request `LoadImpersonation` (grup api + rute Fortify, sebelum `auth:sanctum`) mencocokkan baris terbuka + admin platform yang
   login + izin + pengguna web. Tidak cocok = impersonasi diakhiri (`sesi_tidak_valid`) dan rute klinik menjawab 401.
3. `TenantContext` mengunci konteks ke klinik target (pindah klinik tidak bisa); `EnsureTwoFactor` tidak meminta TOTP owner.
4. `Audit::log`/`Audit::auth` menulis ke `platform_audit_log`, bukan `audit_event`/`auth_event`. GET berhasil dicatat
   `platform.patient_read`/`platform.read`.
5. Berhenti/logout: baris diakhiri, login klinik dibuang, id sesi diganti.

## Diblokir saat impersonasi
`not_impersonating` (403 `impersonation_blocked`): Selesai, setujui draf, koreksi catatan, status/ganti/koreksi tindakan, keputusan
koreksi tindakan & catatan, PIN Selesai, semua rute Fortify (TOTP, konfirmasi kata sandi). Tes:
`tests/Feature/Platform/ImpersonationTest.php`.
