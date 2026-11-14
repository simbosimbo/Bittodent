# Modul Billing

**C3 (minimal):** `invoice` (satu per kunjungan, `payer_patient_id` = penanggung biaya), `invoice_line` (dibuat oleh listener
`Listeners\InvoiceFromProcedure` dari `Clinical\Events\ProcedureRecorded`, harga snapshot `PriceLookup`, append-only), `invoice_adjustment`
(diskon/penghapusan/koreksi, alasan wajib, front desk/pemilik, append-only). Saldo = baris − penyesuaian, dihitung (tidak disimpan).
API: `GET /api/visits/{id}/invoice`, `GET /api/invoices/{id}`, `POST /api/invoices/{id}/adjustments`. Belum: pembayaran, tagihan final, `FinalizedRevenue`.

Cakupan: Tagihan, pembayaran, klaim penjamin (umum, asuransi swasta; siap BPJS: jenis penjamin, no./kelas kepesertaan, status klaim).

Aturan harga (ditegakkan struktur, dicek `ModuleBoundaryTest`):
- Baris tagihan **dibuat otomatis** dari tindakan yang dicatat dokter (`Clinical\Events\ProcedureRecorded` / `Clinical\Contracts`),
  dengan harga **snapshot** dari `Tariffs\Contracts\PriceLookup` saat baris dibuat (perubahan tarif kemudian tidak mengubah tagihan lama).
- Tidak ada API yang membiarkan dokter gigi mengetik harga. Penyesuaian (diskon, dll.) kelak = baris terpisah oleh peran keuangan + alasan + audit.
- Clinical tidak bergantung pada Billing/Tariffs: dokter tidak melihat atau menentukan harga.
- Tagihan final tidak diubah; pendapatan final dibaca modul lain (Compensation) lewat `Billing\Contracts\FinalizedRevenue`.

Bergantung pada: Clinical, Tariffs, Patients (Contracts/Events).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
