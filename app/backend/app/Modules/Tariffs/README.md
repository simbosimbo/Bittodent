# Modul Tariffs (daftar harga)

`tariff`: satu baris = kode tindakan (ICD-9-CM) + **tingkat kesulitan** (`variant` = kode tingkat, `level_label`, `level_rank`; 1 = terendah)
+ harga palsu (rupiah bulat) + periode `valid_from` ≤ tanggal < `valid_to` (NULL = terbuka). Satu **versi** = semua tingkat satu kode dengan `valid_from` yang sama.

**Templat tingkat (D-035)** `Domain\DifficultyTemplate`, di-seed per tenant: tambalan 1 / 2 / 3+ permukaan, scaling ringan/sedang/berat,
pencabutan biasa/sulit (`23.09` Extraction of other tooth), pencabutan bedah (`23.19` Other surgical extraction of tooth, kode tersendiri,
bukan tingkat dari 23.09), pencabutan gigi susu (`23.01` Extraction of deciduous tooth). Templat = titik awal pengaturan, **bukan panduan klinis**;
harga palsu; klinik boleh mengubah/menambah/menghapus tingkat. Kode tingkat 1 selalu `standar` (= default `tooth_finding.variant`).
Kode ICD-9-CM di templat sudah dicek ada di daftar resmi SATUSEHAT ICD9CM_2010; pembagian tingkat dan harga tidak.

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

**Tarif bertingkat (unit A).** Tiga tingkat harga per tenant, semuanya **sel eksplisit** (tidak ada harga hitungan otomatis):
1. **Umum** = `tariff.price_rp` (wajib; templat seed hanya Umum).
2. **Spesialis** = satu harga untuk semua spesialis (`tariff_rate.band = specialist`).
3. **Bidang** spesialis (`band = field`, `field` ∈ `sp_ort` Sp.Ort, `sp_bm` Sp.BM, `sp_kg` Sp.KG, `sp_pros` Sp.Pros, `sp_perio` Sp.Perio, `sp_kga` Sp.KGA).
Ditambah **override per dokter** (`band = dentist`, `dentist_id`) untuk kode tindakan + tingkat tertentu.

Urutan pencarian (`PriceLookup::priceFor/quote` dengan `PriceContext`): override dokter > bidang (hanya spesialis dengan bidang itu) >
Spesialis (hanya spesialis) > Umum. Dokter umum tidak pernah mendapat harga Spesialis/bidang. Tanpa Umum yang berlaku = `no_tariff`
(walau ada sel lain). `priceFor(kode, tingkat, tanggal)` tanpa konteks tetap mengembalikan Umum. Kategori/bidang dokter disimpan di
Tenancy (`dentist_profile`, per tenant; tanpa baris = umum) dan dibawa `Clinical\Events\ProcedureRecorded` ke Billing.

API (hanya pemilik, `tariff.manage`, diaudit): `PUT /api/tariffs/rates {procedure_code, variant, band, field?, dentist_id?, price_rp|null, valid_from}`
— isi (`price_rp`) atau kosongkan (`null`) satu sel mulai `valid_from`; sel terbuka ditutup (`valid_to`). Batas sama dengan tingkat: satu versi
per hari per sel, `valid_from` ≥ hari ini. Audit `tarif_tingkat_diubah` (Spesialis/bidang) / `tarif_override_diubah` (per dokter), detail hanya
id, kode, harga, tanggal. Profil dokter: `PUT /api/dentists/{userId}/profile {category, field?}` (Tenancy, izin `tariff.manage`, audit
`profil_dokter_diubah`). Snapshot di `invoice_line`: `price_rp` (pemenang), `doctor_id`, `dentist_category`, `dentist_field`, `surface`, `procedure_name`.

Ditunda: **unit B** aturan turunan opsional (mis. Spesialis = Umum +30%), **default MATI**, sel eksplisit selalu menang, pratinjau sebelum
diterapkan, diaudit; ubah massal %/Rp. **Unit C** impor/ekspor CSV, berkas templat tarif tenant baru. Belum ada `GET` daftar sel.

Bergantung pada: Tenancy (`TenancyDirectory`: `dentist_id` override harus dokter aktif tenant ini). Dipakai Billing.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
