# Modul Reporting

**Belum ada fitur** (hanya service provider kosong).

Cakupan: Laporan & dasbor (baca saja). Tidak ada modul lain yang boleh bergantung pada Reporting.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
