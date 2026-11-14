# Modul Recall

**C3:** `reminder_log` + `Services\ReminderService` (pengingat janji H-1 dan 2 jam, kanal no-op, `php artisan recall:send-reminders`). Kunci idempoten = janji + jenis + `scheduled_for`; janji dipindah ke jam lain boleh dikirim ulang (jeda minimal 60 menit per jenis). Recall kontrol berkala belum ada.

Cakupan: Pengingat kontrol lewat WhatsApp (D-011): hanya pasien yang memberi izin, template disetujui pemilik, tanpa isi klinis. Kirim lewat outbox (Integrations).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
