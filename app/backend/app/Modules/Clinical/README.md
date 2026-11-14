# Modul Clinical (kunjungan, catatan SOAP, odontogram, persetujuan, koreksi)

Akses (U0d): pemilik hanya **membaca** (`note.read`); tidak pernah menulis draf, menandatangani, atau mengoreksi. Setiap baca chart/baseline/riwayat medis tercatat di `audit_event` (aktor, waktu, `entity_id` = pasien, jenis data; tanpa isi). Kasir tidak punya akses klinis.

## Backlog (belum dibuat)

- TODO: audio dikte dihapus setelah catatan ditandatangani; transkrip + diff draf-vs-final (draf agen vs versi bertanda tangan) disimpan ke audit.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
