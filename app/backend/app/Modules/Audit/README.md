# Modul Audit

**Belum ada fitur** (hanya service provider kosong).

Cakupan: Tampilan/ekspor jejak audit (izin `audit.read`). Penulis audit (`App\Shared\Audit\Audit`) dan tabel `audit_event`/`auth_event` ada di Shared karena semua modul menulis audit.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
