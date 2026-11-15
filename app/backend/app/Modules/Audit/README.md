# Modul Audit

Tampilan jejak audit **baca saja** (izin `audit.read` = pemilik). Penulis audit (`App\Shared\Audit\Audit`) dan tabel
`audit_event`/`auth_event` tetap di Shared karena semua modul menulis audit.

## Log audit (unit 6, DEVIATIONS #52)

`GET /api/audit-events?from=&to=&actor_id=&action=&entity_type=&page=` — terbaru dulu, 50 per halaman. Tanggal = hari lokal
cabang aktif. Tenant saja; user dengan cabang terbatas melihat baris cabangnya + baris tanpa cabang. Keluaran = metadata yang
sudah tersimpan (waktu, pelaku + nama, aksi, entitas, `detail` JSON); tidak ada dekripsi. Membuka daftar diaudit (`audit_dibuka`).

**Tidak ada API ubah/hapus** (PATCH/PUT/DELETE = 404/405). DB juga menolak: trigger MySQL append-only + grant `ehr_app`
tanpa UPDATE/DELETE (`AppendOnlyTest`, `DbUserTest`, `AuditLogTest`). `auth_event` (login) belum ditampilkan.

Bergantung pada: Identity (nama pelaku), Tenancy (zona waktu cabang) — lewat Contracts.
