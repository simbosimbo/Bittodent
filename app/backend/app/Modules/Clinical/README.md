# Modul Clinical (kunjungan, catatan SOAP, odontogram, persetujuan, koreksi)

Akses (U0d): pemilik hanya **membaca** (`note.read`); tidak pernah menulis draf, menandatangani, atau mengoreksi. Setiap baca chart/baseline/riwayat medis tercatat di `audit_event` (aktor, waktu, `entity_id` = pasien, jenis data; tanpa isi). Kasir tidak punya akses klinis.

## Saran kode ICD (usulan)

`GET /api/coding-suggestions?condition=&tooth=&surface=&visit_id=` (izin `note.write`) mengembalikan 1–3 kode ICD-10 (+ ICD-9-CM) dari `coding_rule`. Pemetaan di `Domain/CodingTemplate.php` adalah **usulan/contoh**, bukan standar nasional; perlu ditinjau dokter gigi atau petugas rekam medis. Teks DISPLAY = teks resmi bahasa Inggris dari tabel ICD. Dokter tetap memilih kode; sistem tidak mengisi `diagnosis_code` sendiri. Lihat DEVIATIONS #42.

## Cek saat tanda tangan

`POST /api/visits/{id}/sign` memeriksa draf temuan + kode SOAP sebelum mengunci (`Domain/SignCheck.php`). **Blokir** (422 `sign_blocked`): tindakan pada gigi yang sudah hilang, 23.01 pada gigi tetap atau 23.09/23.19 pada gigi sulung, permukaan tidak cocok. **Peringatan** (422 `warnings`): tindakan tanpa diagnosis, atau diagnosis yang jarang sejalan dengan tindakan (aturan **usulan**, sekarang K02.0 + 23.70/23.71). Dokter tetap bisa menandatangani dengan `accept_warnings: true` + `reason` (min. 10 karakter); alasan dicatat di audit. Lihat DEVIATIONS #44.

## Backlog (belum dibuat)

- TODO: audio dikte dihapus setelah catatan ditandatangani; transkrip + diff draf-vs-final (draf agen vs versi bertanda tangan) disimpan ke audit.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
