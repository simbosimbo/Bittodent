# Modul Reporting

Laporan & dasbor **baca saja**. Tidak ada modul lain yang boleh bergantung pada Reporting. Reporting membaca modul lain
**hanya lewat `Contracts/`** (tidak pernah Models): `Clinical\Contracts\IntegrityFacts`, `Billing\Contracts\IntegrityFacts`,
`Scheduling\Contracts\AppointmentDirectory`, `Identity\Contracts\UserDirectory`, `Patients\Contracts\PatientDirectory`,
`Tenancy\Contracts\TenancyDirectory` (edge di `config/modules.php`).

## Laporan integritas pemilik (unit 6, DEVIATIONS #52)

`GET /api/reports/integrity?from=YYYY-MM-DD&to=YYYY-MM-DD` — izin `reporting.read` (**pemilik saja**). Tanggal = hari lokal
cabang aktif (default Asia/Jakarta), inklusif; default = awal bulan ini s.d. hari ini; maks. 1 tahun. Tenant + cabang yang
boleh dilihat user (`Ctx::branchIds`). Setiap pembukaan diaudit (`laporan_dibuka`, `laporan_integritas`).

Per dokter (semua dokter aktif tenant, juga yang nol; `Tanpa dokter` bila tidak terkait):

| Kolom | Arti | Dokter = |
|---|---|---|
| `external` / `external_pending` / `external_rejected` | tindakan `ada_di_tempat_lain` dicatat di rentang (aktif = tanpa konfirmasi atau terkonfirmasi) | `provider_id` tindakan |
| `rp0`, `full_discount_rp` | diskon/hapus 100% (penyesuaian Rp0) yang disetujui + jumlah Rp-nya. **Hanya diskon**: nota kredit, void, dan baris tarif Rp0 tidak masuk (unit D) | dokter kunjungan |
| `tariff_zero` / `tariff_zero_pending` | **anomali tarif**: baris tagihan berharga Rp0 (semua / yang ditandai `tariff_zero` belum disetujui pemilik); bukan koreksi, bukan diskon | `invoice_line.doctor_id` (atau dokter kunjungan) |
| `rp0_pending` | penyesuaian Rp0 menunggu pemilik | dokter kunjungan |
| `discounts`, `discount_total_rp` | diskon/hapus yang berlaku (biasa + Rp0 disetujui) | dokter kunjungan |
| `full_discounts` | semua permintaan 100% (apa pun keputusannya) | dokter kunjungan |
| `self_approved` | keputusan `self_approved_sole_owner` ("disetujui sendiri") | dokter kunjungan |
| `unbilled_visits` | kunjungan dengan `selesai` berkode tanpa baris tagihan (terbuka atau tutupnya ditolak) | `provider_id` tindakan |
| `batal` | janji `cancelled`/`no_show` + walk-in "batalkan kehadiran" | dokter janji / kunjungan |
| `closed_without_invoice` | kunjungan ditutup tanpa tagihan (pengecualian batal hadir) — **bukan** pelanggaran tanpa tagihan | dokter kunjungan |

Penyesuaian adalah tingkat tagihan (tidak punya baris), jadi dihitung ke dokter kunjungan. `totals` dan `average`
(total ÷ jumlah dokter) ikut dikirim untuk perbandingan "rata-rata klinik".

`alerts` (terbaru dulu): `tanpa_tagihan`, `luar_setelah_datang` (luar dengan konfirmasi `pending`/`confirmed` = dicatat
pada hari yang sudah ada `selesai`), `rp0_menunggu`, `disetujui_sendiri`, `batal_tanpa_tagihan` (pengecualian, bukan sukses
diam). Detail = kode/gigi/jumlah/alasan administratif saja; tanpa SOAP/NIK.

## Metrik koreksi (unit D, DEVIATIONS #58)

Setiap jenis koreksi punya kolom sendiri; tidak ada yang dihitung sebagai "Rp0". Dibaca lewat kontrak baru
`Clinical\Contracts\IntegrityFacts::procedureCorrections` dan `Billing\Contracts\IntegrityFacts::reversals`, `::lineCorrections`,
`::linePricesByProcedure` (tanpa edge modul baru). Rentang = `created_at` permintaan. Jumlah = yang **berlaku** (diterapkan /
langsung berlaku / disetujui pemilik); yang menunggu dihitung terpisah.

| Kolom | Arti | Dokter = |
|---|---|---|
| `corr_salah_kode`, `corr_salah_situs`, `corr_salah_provider`, `corr_tidak_dikerjakan` | koreksi tindakan yang berlaku, per jenis alasan | `provider_id` tindakan **asli** (baris yang dikoreksi) |
| `corr_total_rp` | harga baris tagihan pada rantai tindakan yang dikoreksi (0 bila tidak tertagih) | idem |
| `corr_outside_window` | diajukan di luar tenggat (apa pun keputusannya) | idem |
| `corr_owner_approved` / `corr_self_approved` / `corr_pending` / `corr_rejected` | disetujui pemilik / di antaranya pemilik tunggal / menunggu / ditolak | idem |
| `cn_partial(_rp)`, `cn_full(_rp)` | nota kredit sebagian / penuh yang berlaku | `invoice_line.doctor_id` baris yang dikredit (atau dokter kunjungan) |
| `cn_pending(_rp)`, `cn_approved` | nota kredit menunggu pemilik / disetujui pemilik | idem |
| `refunds`, `refund_rp`, `refund_pending(_rp)` | refund disetujui / menunggu | dokter baris nota kredit refund itu |
| `voids`, `void_rp`, `void_pending(_rp)` | void berlaku / menunggu; Rp = jumlah harga baris tagihan | dokter kunjungan (void tingkat tagihan) |
| `reversal_self_approved` | nota kredit/void/refund yang disetujui pemilik tunggal (`self_approved_sole_owner`) | seperti di atas |

Peringatan baru: `koreksi_menunggu` (koreksi tindakan menunggu pemilik), `pembalikan_menunggu` (nota kredit penuh/void/refund
menunggu; `detail.type`), `pembalikan_disetujui_sendiri`, `tarif_nol` (baris tarif Rp0 belum disetujui), `tinjau_koreksi_lama`
(penanda "perlu tinjau koreksi" yang belum diurus lebih dari `IntegrityReport::REVIEW_STALE_DAYS` = 2 hari sejak dibuat, dihitung
terhadap waktu sekarang). Detail = id, jenis, jumlah, nomor NK; tanpa alasan bebas/teks klinis.

**Ditunda (bukan di stack ini):** peringatan "Stok tanpa tagihan" (modul Inventory belum ada), "Struk WhatsApp" (papan
layar 27), tampilan rapi layar 25–28 (bot UI), ekspor.
