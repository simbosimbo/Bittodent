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
| `rp0` | penyesuaian Rp0 yang disetujui + baris tagihan berharga Rp0 (tarif Rp0) | dokter kunjungan / `invoice_line.doctor_id` |
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

**Ditunda (bukan di stack ini):** peringatan "Stok tanpa tagihan" (modul Inventory belum ada), "Struk WhatsApp" (papan
layar 27), tampilan rapi layar 25–28 (bot UI), ekspor.
