# Modul Prescriptions (resep)

**U0c (kerangka: tabel + model + trigger, belum ada API).** Keputusan D-036 (diterima Jerome):

- **MVP = resep tertulis biasa:** dicetak dari sistem dan **ditandatangani dokter gigi di kertas**. Data tetap disimpan terstruktur:
  `prescription` (nomor, pasien, kunjungan, cabang, dokter, `state`, `content_hash` = sidik isi cetakan, `signed_at`) +
  `prescription_item` (`kfa_code` plaintext D-020 + `dosage_enc` = JSON terenkripsi; **dosis, rute, frekuensi, durasi wajib**, dicek `PrescriptionItem::setDosage`).
- `state`: `draft` → `signed` (dikunci + dicetak). Draf boleh diubah; resep `signed` dan itemnya **tidak bisa diubah/dihapus** (trigger MySQL, juga untuk ehr_admin).
- Koreksi = **batal dengan alasan** (`prescription_void`, alasan terenkripsi, append-only) + **terbit ulang dengan nomor baru** (`supersedes_id` → resep lama). Resep lama tetap tersimpan.
- Hanya dokter gigi berizin yang membuat, mengunci, dan mencetak. Asisten, kasir, pemilik, dan agen AI tidak meresepkan/memilih obat; AI tidak mengisi kamus obat.
- Peringatan alergi/obat dobel + alasan bila tetap lanjut; sistem tidak menyarankan/mengganti obat (belum dibuat).
- **Belum ada pengiriman SATUSEHAT** (`MedicationRequest` / Nomor Resep Nasional), WhatsApp, atau QR: seam saja; kelak lewat `outbox` setelah modul kefarmasian SATUSEHAT keluar dari sandbox.
- Formulir cetak wajib memuat isi Permenkes 34/2021 Pasal 7 (belum dibuat). Daftar obat dalam kewenangan dokter gigi: perlu dicek.

Bergantung pada: Patients, Clinical (Contracts).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
