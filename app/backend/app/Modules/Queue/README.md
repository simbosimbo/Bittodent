# Modul Queue (antrean)

**Belum ada fitur.**

Akan memiliki: daftar tunggu per cabang hari ini dengan state `menunggu → dipanggil → di_kursi → selesai`, dan `batal` dari state yang belum selesai.

Invarian:
- State diubah hanya lewat fungsi transisi state machine (bukan boolean, bukan set bebas); `selesai`/`batal` final.
- Data janji dibaca lewat `Scheduling\Contracts\AppointmentDirectory`; Queue tidak mengubah status janji secara langsung (kalau perlu sinkron, lewat kontrak Scheduling yang baru).
- Setiap baris terikat ke cabang; layar antrean tidak menampilkan isi klinis.

Bergantung pada: Scheduling (Contracts).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
