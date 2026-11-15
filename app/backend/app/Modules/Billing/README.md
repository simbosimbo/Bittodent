# Modul Billing

**C3 (minimal):** `invoice` (satu per kunjungan, `payer_patient_id` = penanggung biaya), `invoice_line` (dibuat oleh listener
`Listeners\InvoiceFromProcedure` dari `Clinical\Events\ProcedureRecorded`, harga snapshot `PriceLookup`, append-only), `invoice_adjustment`
(diskon/penghapusan/koreksi, alasan wajib, front desk/pemilik, append-only). Saldo = baris − penyesuaian, dihitung (tidak disimpan).
API: `GET /api/visits/{id}/invoice`, `GET /api/invoices/{id}`, `POST /api/invoices/{id}/adjustments`,
`POST /api/invoice-adjustments/{id}/approve|reject` (unit 4), `POST /api/invoices/{id}/payments`, `GET|POST /api/payment-accounts`,
`PATCH /api/payment-accounts/{id}` (unit 5), nota kredit / void / koreksi baris (unit B, di bawah). Belum: refund (unit C), tagihan final, `FinalizedRevenue`.

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

## Pembayaran hanya ke akun klinik (unit 5, DEVIATIONS #51)
- **Akun bayar** (`payment_account`): data master milik tenant, opsional per cabang (`branch_id` NULL = semua cabang), jenis
  `tunai | qris | edc | transfer`, `bank_name` + `account_last4` (nomor lengkap tidak disimpan). Dikelola pemilik saja
  (`billing.accounts`); tidak dihapus, dinonaktifkan. Jenis/cabang/bank tetap setelah dibuat. Tenant baru mulai tanpa akun.
- **Pembayaran** (`invoice_payment`, append-only): selalu menunjuk akun klinik aktif di tenant yang sama dan berlaku untuk cabang
  tagihan. **Tidak ada field rekening tujuan**; field tak dikenal = 422. Tidak boleh melebihi sisa (`overpay`). Split = beberapa
  pembayaran. `request_key` opsional mencegah bayar dua kali saat kirim ulang.
- **Saldo** = baris − penyesuaian berlaku − pembayaran (dihitung). `invoice.status`: `terbuka` | `lunas` (saldo 0 dan ada baris).
  Diskon 100% yang menunggu pemilik tidak mengurangi saldo.

## Koreksi finansial: nota kredit, void, koreksi baris (unit B, DEVIATIONS #56)
Prinsip (Yohanes): koreksi **tidak pernah** berupa baris Rp0 atau diskon 100%. Koreksi klinis dan koreksi finansial = dokumen terpisah.
Baris tagihan asli (kode, nama, harga), penyesuaian, dan pembayaran tidak pernah diubah atau dihapus.
- **Nota kredit** (`credit_note`, tabel sendiri, append-only): selalu satu `invoice_line_id`; `procedure_correction_id` bila dari koreksi
  klinis (kosong untuk salah tarif murni); `amount_rp` 1..sisa yang bisa dikredit (harga − nota kredit yang tidak ditolak; yang menunggu
  ikut memesan jumlahnya); `reason_type` (`tidak_dikerjakan`, `salah_kode`, `salah_situs`, `salah_provider`, `salah_tarif`, `lainnya`) +
  alasan wajib. Nomor `NK-YYYY-000001` berurutan per tenant per tahun (`credit_note_seq`, kunci baris). **Sebagian** (`billing.adjust`:
  front desk, kasir, pemilik) langsung berlaku. **Penuh** (= sisa baris) menunggu pemilik (`billing.approve_reversal`, izin baru, pemilik
  saja; konflik kepentingan sama dengan unit 4). Tidak boleh melebihi saldo (sudah dibayar = 422 `refund_required`; refund = unit C).
  `POST /api/invoices/{id}/credit-notes`, `POST /api/credit-notes/{id}/approve|reject`.
- **Tampilan kasir**: baris tetap dengan harga asli + `credit_note_numbers`/`credited_rp` ("Dikoreksi — lihat NK-…"), tidak pernah Rp0.
  Tagihan yang seluruhnya dikredit tidak menjadi "lunas".
- **Dari koreksi klinis** (`Listeners\CreditFromCorrection` atas `Clinical\Events\ProcedureCorrected`): `tidak_dikerjakan` + baris
  tertagih di rantai koreksi → nota kredit penuh **menunggu** pemilik, tertaut koreksi. `salah_kode/situs/provider` → tidak ada uang
  bergerak; `line_correction` = "perlu tinjau koreksi" di API tagihan (`lines[].correction_reviews`). Kasir: nota kredit (sebagian/penuh),
  `POST /api/invoices/{id}/lines/from-correction/{correctionId}` ("Tagih kode yang benar": baris baru untuk tindakan hasil koreksi dengan
  snapshot tarif sekarang lewat `InvoiceFromProcedure`; idempoten; baris lama tetap; tarif tidak ada = 422 `tariff_missing`), atau
  `POST /api/line-corrections/{id}/review {reason}` (harga sama, tanpa dokumen uang; diaudit).
- **`kind=correction`** (selisih tarif ±) kini wajib `invoice_line_id` (+ `procedure_correction_id` opsional, harus terkait baris itu);
  baris lama tanpa baris tetap NULL. `discount`/`write_off` hanya untuk diskon sah, bukan untuk membetulkan tindakan (aturan Rp0 unit 4 tetap).
- **Void** (`invoice_void` + `invoice.status = void`, `Domain\InvoiceStatus`): hanya tagihan **tanpa pembayaran apa pun**
  (ada = 422 `has_payments`: pakai nota kredit + refund). Alasan ≥10. Ada baris tagihan (selalu dari tindakan `selesai`) = menunggu
  pemilik (`billing.approve_reversal`, `POST /api/invoice-voids/{id}/approve|reject`); tanpa baris = langsung. Baris tetap, saldo 0,
  status "Dibatalkan (void)"; pembayaran/penyesuaian/nota kredit berikutnya = 409 `invoice_void`; tindakan baru di kunjungan itu tidak
  dibuatkan baris (audit `tagihan_void`, penjaga tutup kunjungan memblok).
- **Daftar menunggu pemilik**: `GET /api/billing/reversals/pending` (nota kredit penuh + void, cabang yang dicakup).
- **Penjaga tutup kunjungan**: baris yang dikredit/di-void tetap "sudah diurus" (barisnya ada). Nota kredit penuh / void yang
  **menunggu** memblok (409 `invoice_required`, id tindakannya) sampai pemilik memutus. `tidak_dikerjakan` tanpa tagihan tidak butuh apa-apa.
- **Tarif Rp0** (anomali master tarif, bukan koreksi): baris tetap dibuat dengan `tariff_zero = true` (audit `tarif_nol`), tampil
  "Tarif Rp0 — menunggu pemilik"; pemilik `POST /api/invoice-lines/{id}/approve-zero-tariff` (`billing.approve_zero`, konflik kepentingan
  sama). Tidak memblok tutup kunjungan. Tidak bisa dikredit (nilai 0).
- Keputusan pemilik / tinjau kasir: `billing_decision` (satu per subjek, append-only). Audit: `nota_kredit.dibuat|menunggu|disetujui|ditolak|konflik`,
  `void.dibuat|menunggu|disetujui|ditolak|konflik`, `koreksi_tagihan.perlu_tinjau|ditagih|ditinjau`, `tarif_nol`, `tarif_nol.disetujui|konflik`.

Cakupan: Tagihan, pembayaran, klaim penjamin (umum, asuransi swasta; siap BPJS: jenis penjamin, no./kelas kepesertaan, status klaim).

Aturan harga (ditegakkan struktur, dicek `ModuleBoundaryTest`):
- Baris tagihan **dibuat otomatis** dari tindakan yang dicatat dokter (`Clinical\Events\ProcedureRecorded` / `Clinical\Contracts`),
  dengan harga **snapshot** dari `Tariffs\Contracts\PriceLookup` saat baris dibuat (perubahan tarif kemudian tidak mengubah tagihan lama).
- Tidak ada API yang membiarkan dokter gigi mengetik harga. Penyesuaian (diskon, dll.) kelak = baris terpisah oleh peran keuangan + alasan + audit.
- Clinical tidak bergantung pada Billing/Tariffs: dokter tidak melihat atau menentukan harga.
- Tagihan final tidak diubah; pendapatan final dibaca modul lain (Compensation) lewat `Billing\Contracts\FinalizedRevenue`.

Bergantung pada: Clinical, Tariffs, Patients, Tenancy (Contracts/Events; Tenancy = hitung pemilik aktif, unit 4). Unit B: `Clinical\Events\ProcedureCorrected` (edge lama).

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.

Unit 6: `Contracts\IntegrityFacts` (baca saja, untuk Reporting): tindakan yang sudah punya baris, penyesuaian diskon/hapus + keputusan (`self_approved_sole_owner`), baris Rp0. Lihat DEVIATIONS #52.
