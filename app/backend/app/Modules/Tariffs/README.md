# Modul Tariffs (daftar harga)

`tariff`: satu baris = kode tindakan (ICD-9-CM) + **tingkat kesulitan** (`variant` = kode tingkat, `level_label`, `level_rank`; 1 = terendah)
+ harga palsu (rupiah bulat) + periode `valid_from` ≤ tanggal < `valid_to` (NULL = terbuka). Satu **versi** = semua tingkat satu kode dengan `valid_from` yang sama.

**Templat tingkat (D-035)** `Domain\DifficultyTemplate`, di-seed per tenant: tambalan 1 / 2 / 3+ permukaan, scaling ringan/sedang/berat,
pencabutan biasa/sulit/bedah. Templat = titik awal pengaturan, **bukan panduan klinis**; klinik boleh mengubah/menambah/menghapus tingkat.
Kode tingkat 1 selalu `standar` (= default `tooth_finding.variant`). Kode ICD-9-CM di templat = contoh, perlu dicek.

API: `PUT /api/tariffs/{id}/levels {valid_from, levels: [{code, label, price_rp}]}` — hanya pemilik (`tariff.manage`), diaudit (`tarif_diubah`).
Membuat **versi baru** untuk kode tindakan baris `{id}`: baris terbuka ditutup (`valid_to = valid_from`), tingkat baru ditambahkan; urutan = peringkat.
`valid_from` ≥ hari ini dan > versi terakhir (409 bila tidak). Versi lama tetap; baris tagihan menyimpan snapshot harganya sendiri.

**Tingkat tertinggi wajib alasan** saat dipilih dokter. Belum ditegakkan: Clinical tidak boleh bergantung pada Tariffs (D-035), jadi
Clinical tidak tahu tingkat mana yang tertinggi. Rencana: `tooth_finding.variant_reason` + ikut `ProcedureRecorded`; Billing (yang tahu peringkat
lewat `PriceLookup`) menandai/menolak tingkat tertinggi tanpa alasan. Lihat DEVIATIONS #36.

Invarian:
- Harga berlaku menurut tanggal: periode lewat tidak diubah (hanya `valid_to` baris terbuka diisi saat versi baru).
- Modul lain membaca harga hanya lewat `Tariffs\Contracts\PriceLookup` (kode tindakan + tingkat + tanggal → harga).
- Diubah hanya oleh pemilik. Clinical tidak bergantung pada Tariffs (dokter memilih tingkat, tidak melihat/menentukan harga).

Bergantung pada: — (dipakai Billing).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
