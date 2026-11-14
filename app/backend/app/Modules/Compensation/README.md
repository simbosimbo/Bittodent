# Modul Compensation (bagi hasil dokter)

**U0c (kerangka, belum ada fitur/tabel/API).** Keputusan D-034 (diterima Jerome):

- `Domain\CompensationBasis`: dasar perhitungan bagi hasil. **Default `after_material_and_lab`**: persentase dihitung dari
  pendapatan **dikurangi** biaya bahan + lab (`baseRp()`, rupiah bulat). Alternatif `before_costs` (dari pendapatan kotor) ada, tetapi bukan default.
  Aturan baru tanpa pilihan eksplisit memakai `CompensationBasis::default()`.
- `Contracts\FeeCalculator` (stub, belum ada implementasi/binding): bagi hasil satu tindakan final menurut aturan yang **berlaku pada tanggal tindakan**.

Invarian:
- Aturan per dokter + kelompok tindakan (+ tingkat kesulitan bila pemilik mengatur), persen atau nominal tetap, berlaku per periode (`valid_from`).
  Aturan lama tidak diubah/dihapus; menyimpan aturan baru **tidak menghitung ulang** periode yang sudah lewat (hasil hitung disimpan).
- Pendapatan dibaca **hanya** dari tagihan final lewat `Billing\Contracts\FinalizedRevenue` (tidak membaca tabel/model Billing).
- Dokter dibaca lewat `Identity\Contracts\UserDirectory`.
- Data keuangan sensitif: pengaturan & laporan hanya pemilik; setiap ubahan/unduhan diaudit. Dokter dan kasir tidak melihatnya di layar kerja.
- Hasil negatif (biaya > pendapatan): perlu dicek (belum diputuskan).

## Backlog (belum dibuat)

- TODO: dokter gigi hanya melihat laporan bagi hasil miliknya sendiri, baca saja (tanpa ubah aturan/angka; tidak melihat dokter lain).

Bergantung pada: Billing, Identity (Contracts).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
