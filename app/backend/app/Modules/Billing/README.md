# Modul Billing

**C3 (minimal):** `invoice` (satu per kunjungan, `payer_patient_id` = penanggung biaya), `invoice_line` (dibuat oleh listener
`Listeners\InvoiceFromProcedure` dari `Clinical\Events\ProcedureRecorded`, harga snapshot `PriceLookup`, append-only), `invoice_adjustment`
(diskon/penghapusan/koreksi, alasan wajib, front desk/pemilik, append-only). Saldo = baris − penyesuaian, dihitung (tidak disimpan).
API: `GET /api/visits/{id}/invoice`, `GET /api/invoices/{id}`, `POST /api/invoices/{id}/adjustments`,
`POST /api/invoice-adjustments/{id}/approve|reject` (unit 4). Belum: pembayaran, tagihan final, `FinalizedRevenue`.

## Penjaga tagihan kunjungan (unit 4, DEVIATIONS #50)
- **Letak modul.** Tutup kunjungan ada di Clinical (`POST /api/visits/{id}/close`, `Services\VisitCloser`). Sebelum menutup, Clinical
  mengirim `Clinical\Events\VisitClosing` (berisi id tindakan `selesai`); `Listeners\InvoiceGuard` di Billing memanggil `block()` untuk
  tindakan tanpa `invoice_line` di tagihan kunjungan itu. Clinical tidak pernah mengimpor Billing. Janji → `done` (Scheduling) mengirim
  `Scheduling\Events\AppointmentCompleting`; Clinical mendengarnya dan menutup kunjungan dengan aturan yang sama (gagal = transisi batal).
- **Aturan.** Ada `selesai` berkode (draf atau final; koreksi atas `selesai` tidak dihitung dua kali) tanpa baris tagihan = 409
  `invoice_required` (tanpa tarif juga terblokir: tidak ada baris). Kunjungan tanpa `selesai` boleh ditutup tanpa tagihan.
- **Satu-satunya pengecualian (Yohanes, 15 Nov 2026: "Ya kecuali dibatalkan kehadirannya").** Janji `cancelled`/`no_show`, atau
  kunjungan walk-in yang dicatat `POST /api/visits/{id}/cancel-attendance {reason}`: boleh ditutup tanpa tagihan **dengan alasan**
  (≥10 huruf, 422 bila kosong); `visit.close_reason`, `visit.closed_without_invoice = true`, audit `tutup`. Alasan tanpa pembatalan = tetap 409.
- **Rp0 / diskon 100%.** Penyesuaian yang membuat saldo tepat Rp0 disimpan `requires_approval` (202, status `pending`), tidak mengubah
  saldo sampai pemilik memutuskan (`invoice_adjustment_decision`, append-only, sekali per penyesuaian). Izin baru `billing.approve_zero`
  = **pemilik saja**. Pemilik yang menangani tindakannya sendiri (dokter baris tagihan / dokter kunjungan) ditolak 403
  `conflict_of_interest` bila ada pemilik aktif lain; pemilik tunggal boleh, ditandai `self_approved_sole_owner` (laporan pemilik, unit 6).

Cakupan: Tagihan, pembayaran, klaim penjamin (umum, asuransi swasta; siap BPJS: jenis penjamin, no./kelas kepesertaan, status klaim).

Aturan harga (ditegakkan struktur, dicek `ModuleBoundaryTest`):
- Baris tagihan **dibuat otomatis** dari tindakan yang dicatat dokter (`Clinical\Events\ProcedureRecorded` / `Clinical\Contracts`),
  dengan harga **snapshot** dari `Tariffs\Contracts\PriceLookup` saat baris dibuat (perubahan tarif kemudian tidak mengubah tagihan lama).
- Tidak ada API yang membiarkan dokter gigi mengetik harga. Penyesuaian (diskon, dll.) kelak = baris terpisah oleh peran keuangan + alasan + audit.
- Clinical tidak bergantung pada Billing/Tariffs: dokter tidak melihat atau menentukan harga.
- Tagihan final tidak diubah; pendapatan final dibaca modul lain (Compensation) lewat `Billing\Contracts\FinalizedRevenue`.

Bergantung pada: Clinical, Tariffs, Patients, Tenancy (Contracts/Events; Tenancy = hitung pemilik aktif, unit 4).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
