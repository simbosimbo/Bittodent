# Rencana: Tindakan gaya kasir (16 Nov 2026)

Dasar: keputusan pemilik 16 Nov 2026 (draf D-045, D-046, D-047 di `docs/plans/2026-11-16-keputusan-D-045-D-047.md`), artboard TK01 sampai TK09, dan kode di `app/`. Belum ada kode yang diubah. Path di bawah relatif ke `app/`.

Prinsip yang dipegang: pemilik yang mengatur (harga, kunjungan, aturan tagih, bahan). Pengaturan kosong atau tidak cocok = "menunggu diisi pemilik", tidak ditebak. Catatan klinis tetap draf sampai dokter menandatangani.

## 1. Temuan dari kode (yang menentukan rancangan)

- Batas modul (`backend/config/modules.php`, dites `tests/Feature/ModuleBoundaryTest.php`): Clinical tidak boleh memakai Tariffs/Billing. Billing boleh memakai Clinical, Tariffs, Patients, Tenancy. Tariffs hanya Tenancy. Inventory kosong.
- Sudah ada contoh layar dokter membaca Tariffs langsung: `GET /api/tariffs/stages` (izin `note.write`, hanya label). Jadi "dokter melihat harga" cukup endpoint baca baru; server Clinical tidak perlu berubah.
- Tagihan: `Billing\Listeners\InvoiceFromProcedure` membuat satu `invoice_line` per `procedure_id` (UNIQUE, NOT NULL) dari event `Clinical\Events\ProcedureRecorded`, yang hanya dikirim saat tindakan `selesai` difinalkan di Selesai. Belum ada jalur tagihan sebelum Selesai.
- Penjaga tutup kunjungan (`Billing\Listeners\InvoiceGuard`): setiap tindakan `selesai` wajib punya baris tagihan. Baris Rp0 dari tarif sah (DEVIATIONS #78).
- Pola "boleh menolak" antar modul sudah ada: event `VisitClosing` dengan `block()`. Pola tulis lewat kontrak juga ada (Intake ke `Patients\Contracts\MedicalAlerts`).
- Harga berversi `valid_from` per kode + tingkat (`tariff`), ditambah sel Spesialis/bidang/per dokter. `PriceLookup::priceFor()` tanpa konteks dokter = harga Umum tersimpan.
- `invoice_line` hanya-tambah (trigger). Nota kredit selalu menunjuk satu `invoice_line_id`; nota kredit sebagian langsung berlaku, penuh menunggu pemilik; refund selalu menunggu pemilik.
- Sidik tanda tangan (`Clinical\Domain\SelesaiSignature::canonical`) memuat kolom tindakan tertentu. Kolom baru tidak boleh masuk hitungan sidik versi 1.
- `frontend/src/modules/clinical/Chart.tsx` (923 baris) dan tesnya sedang punya perubahan yang belum di-commit. Selesaikan dulu sebelum T1.
- Compensation (bagi hasil) masih kosong; belum terdampak, tapi lihat Q-26.

## 2. Batas modul

| Fakta | Pemilik data | Dibaca oleh |
|---|---|---|
| Jenis tindakan (tunggal/multi), daftar kunjungan paket | Clinical (`procedure_definition`, tabel langkah) | SPA; Billing lewat event |
| Harga, aturan tagih, cicilan, komponen + kuota | Tariffs | SPA (endpoint baca); Billing lewat kontrak `PackageTerms` |
| Bahan + harga satuan | Inventory | Tariffs lewat kontrak (sisi baru Tariffs → Inventory) |
| Perawatan berjalan pasien (gigi, langkah ke berapa, status) | Clinical (`treatment_course`) | Billing lewat event + kontrak |
| Harga terkunci, jadwal tagih, baris tagihan | Billing | SPA dokter dan kasir |

- **Dokter melihat harga:** SPA memanggil `GET /api/tariffs/price-list` (Tariffs) dan, mulai T3, `GET /api/visits/{id}/billing-preview` (Billing). Server Clinical tidak mengimpor apa pun; `ProcedureRecorded` tetap tanpa harga. Angka di keranjang = pratinjau; yang sah tetap baris tagihan.
- **Event pemicu tagihan paket:**
  1. `Clinical\Events\CourseStarting` (baru, bisa diblok seperti `VisitClosing`): dikirim saat dokter menekan "Mulai paket". Billing mengunci harga, membuat jadwal tagih, dan langsung membuat baris DP / lunas di depan. Pengaturan belum lengkap → Billing memblok → 422 "menunggu diisi pemilik", tidak ada yang tersimpan.
  2. `Clinical\Events\ProcedureRecorded` (ditambah `courseId`, `courseStep`, keduanya boleh kosong): saat langkah paket difinalkan di Selesai, Billing menagih baris jadwal yang jatuh di langkah itu (cicilan / pelunasan), atau baris Rp0 bila tidak ada.
- Hentikan paket: endpoint Billing memanggil `Clinical\Contracts\CourseDirectory::markStopped()` (sisi Billing → Clinical sudah ada).

## 3. Model data

Semua tabel: `tenant_id` + `id` (UUIDv7), PK `(tenant_id, id)`, FK gabungan `(tenant_id, x_id)`, model memakai `BelongsToTenant`, rupiah bilangan bulat, grant + trigger di `backend/database/migrations/mysql/` (database.md 11).

| Tabel / kolom | Modul | Isi | Sifat |
|---|---|---|---|
| `procedure_definition.kind`, `.duration_min` | Clinical | `single` / `multi`; baris lama = `single` (memang begitu cara kerjanya hari ini) | diubah pemilik, diaudit |
| `procedure_step_set` | Clinical | `procedure_code`, `valid_from`, `created_by`; satu versi daftar kunjungan | hanya-tambah |
| `procedure_step` | Clinical | `step_set_id`, `seq`, `name`, `duration_min`, `description`, `gap_days` | hanya-tambah |
| `treatment_course` | Clinical | `branch_id`, `patient_id`, `procedure_code`, gigi/situs, `step_set_id` (versi yang dipakai), `started_visit_id`, `started_by`, `status` `berjalan/selesai/dihentikan`, alasan henti | status lewat fungsi transisi + audit |
| `procedure_record.course_id`, `.course_step` | Clinical | tautan langkah paket, boleh kosong | ikut aturan baris final (tidak diubah) |
| `tariff_package_rule` | Tariffs | `procedure_code`, `valid_from`, `mode` `dp/lunas_depan/cicil`, `dp_percent` | hanya-tambah (versi baru = baris baru) |
| `tariff_package_instalment` | Tariffs | `rule_id`, `seq`, `amount_rp` | hanya-tambah |
| `tariff_package_component` (T5) | Tariffs | versi per `valid_from`: `procedure_code`, `step_seq`, `material_id`, `qty`, `free_qty` (kosong = gratis semua) | hanya-tambah |
| `material`, `material_price` (T5) | Inventory | nama, satuan, aktif; harga satuan per `valid_from` | harga hanya-tambah |
| `patient_package` | Billing | `course_id` (UNIQUE), `branch_id`, `patient_id`, kode + nama + gigi (salinan), `price_rp` terkunci, `mode`, `dp_percent`, `rule_id`, `started_visit_id`, `locked_at` | hanya-tambah |
| `package_schedule` | Billing | `package_id`, `due_step` (0 = saat mulai), `kind` `dp/pelunasan/lunas/cicilan`, `amount_rp` | hanya-tambah; "sudah ditagih" diturunkan dari baris tagihan |
| `package_component` (T5) | Billing | salinan saat mulai: `package_id`, `step`, nama bahan, satuan, `unit_price_rp`, `qty`, `free_qty` | hanya-tambah |
| `patient_package_stop` (T4) | Billing | `package_id` (UNIQUE), alasan, oleh, waktu | hanya-tambah; status paket diturunkan |
| `invoice_line` | Billing | `procedure_id` jadi boleh kosong; tambah `package_id`, `package_schedule_id` (UNIQUE), `package_component_id` (UNIQUE, T5), `qty` (T5) | tetap hanya-tambah |

Invarian yang dites: jumlah `package_schedule.amount_rp` = `patient_package.price_rp`; satu baris jadwal ditagih paling banyak sekali; jumlah baris tagihan paket yang selesai penuh = harga terkunci.

## 4. Keputusan teknis yang saya ambil (mengikuti pola yang ada)

1. **Versi dengan `valid_from`** untuk daftar kunjungan, aturan tagih, komponen, dan harga bahan: sama dengan `tariff`, supaya periode lama tidak pernah diubah.
2. **Paket yang berjalan menyimpan salinan** harga, aturan, jadwal, dan komponen di Billing, dan menunjuk `step_set_id` yang tidak bisa berubah: sama dengan salinan harga di `invoice_line`.
3. **Harga bahan dikunci saat paket dimulai**, bersama harga paket: jumlah dan kuota sudah tetap dari pemilik, jadi biaya bahan bisa disebut ke pasien sejak awal dan paket berjalan tidak berubah.
4. **Paket = satu tingkat (`standar`) dan satu harga Umum untuk semua dokter**: keputusan pemilik "satu harga paket", dan cicilan harus berjumlah tepat satu angka. Tariffs menolak tingkat kedua dan sel Spesialis/bidang/per dokter untuk kode berpaket (422). Lihat Q-23.
5. **DP = pembulatan ke bawah `harga × persen / 100` (rupiah bulat); pelunasan = harga − DP**: hitungan bilangan bulat tanpa pecahan, selisih pembulatan jatuh ke pelunasan.
6. **Setiap langkah paket tetap satu baris tagihan per tindakan** (Rp0 bila tidak ada yang jatuh tempo, dengan keterangan): penjaga tutup kunjungan tidak perlu aturan baru dan cocok dengan TK09. Baris tanpa tindakan hanya DP/lunas saat mulai dan bahan di atas kuota.
7. **Langkah paket berurutan, boleh lebih dari satu langkah dalam satu kunjungan**: paket yang selesai lebih cepat tetap memicu pelunasan tanpa aturan khusus. Kunjungan tambahan di luar rencana = tindakan tunggal biasa.
8. **Server yang menentukan nomor langkah berikutnya**, bukan klien: mencegah langkah lompat atau dobel.
9. **Kode `multi` hanya bisa dicatat `selesai` lewat paket**; `multi` tanpa daftar kunjungan ditolak Clinical: mencegah paket tertagih sebagai tindakan tunggal seharga paket.
10. **Izin baru `price.view`** untuk peran dokter gigi (bukan menumpang `note.write`): asisten tidak ikut melihat harga tanpa keputusan pemilik.
11. **Kolom paket di luar sidik tanda tangan versi 1**: tanda tangan lama tetap bisa diverifikasi.
12. **Nota kredit / penyesuaian pada baris paket selalu menunggu pemilik**, juga yang sebagian: keputusan 6 mewajibkan persetujuan pemilik, sedangkan nota kredit sebagian hari ini langsung berlaku.

## 5. Tahap (urut ketergantungan)

Perubahan urutan dari usul awal: **"Hentikan paket" dimajukan ke T4, komponen menjadi T5.** Alasannya dari kode: T3 membuat tagihan DP di luar alur Selesai, dan satu-satunya cara membatalkannya adalah nota kredit. Tanpa T4, paket yang salah dimulai tidak punya jalan keluar yang rapi. **T3 jangan dirilis ke demo tanpa T4.**

Setiap tahap: tulis tes dulu, lalu kode, lalu catat di `DEVIATIONS.md` (mulai #81) dan README modul.

### T1. Dokter melihat harga + keranjang untuk tindakan tunggal (tanpa skema baru)
- Server: `backend/app/Modules/Tariffs/Http/Controllers/TariffController.php` (`priceList`), `Tariffs/Routes/routes.php`, `backend/app/Shared/Permissions/Permissions.php` (`price.view`). `GET /api/tariffs/price-list` → per kode: nama, tingkat `{variant, label, price_rp}` untuk dokter yang sedang login (jalur `PriceLookupService::quote` yang sama dengan tagihan). Kode tanpa harga tidak muncul.
- Layar: `frontend/src/modules/clinical/Chart.tsx` dipecah ke `clinical/kasir/CatalogPanel.tsx` (kiri), odontogram yang ada (tengah), `clinical/kasir/CartPanel.tsx` (kanan: draf tindakan kunjungan ini, harga per baris, total); `clinical/api.ts` (`getPriceList`); `clinical/clinical.css`. HP (TK05): keranjang sebagai lembar bawah. Simpan tetap lewat `POST /api/visits/{id}/tooth-entries` dan ubah/hapus draf yang ada.
- Tes dulu:
  - `tests/Modules/Tariffs/PriceListTest.php`: `dokter_melihat_harga_band_miliknya`, `kode_tanpa_harga_tidak_muncul`, `asisten_dan_tanpa_izin_403`, `tenant_lain_tidak_terlihat`, `tidak_ada_rute_dokter_mengubah_harga`.
  - `tests/Feature/PermissionMatrixTest.php`: `price.view` hanya dokter gigi.
  - `Chart.test.tsx`: baris keranjang menampilkan harga dan total; tindakan tanpa gigi langsung masuk keranjang; pilih tindakan → pilih gigi/permukaan → baris + odontogram terisi; tindakan tanpa harga tampil "Harga menunggu diisi pemilik" dan tombolnya mati; ganti tingkat mengubah harga baris; dokter tidak punya kolom isian harga.
- Migrasi: tidak ada.
- Risiko: (uang) pratinjau bisa beda dari tagihan bila dokter pelaksana bukan dokter yang login atau tarif berganti versi tengah malam; tampilkan "Harga final mengikuti tagihan". (tenant) endpoint baru wajib lewat model ber-`BelongsToTenant`. (klinis) alur Selesai tidak disentuh.
- Dokumen ikut diubah: README Tariffs/Billing, komentar `ProcedureRecorded` ("never sees prices").
- TIDAK dikerjakan: paket, komponen, diskon oleh dokter, wajib alasan tingkat tertinggi di server (tetap DEVIATIONS #36), penolakan server untuk kode tanpa harga.

### T2. Pengaturan pemilik: jenis tindakan, kunjungan, aturan tagih (belum dipakai dokter)
- Clinical: migrasi `2026_11_17_000001_procedure_kind_steps.php` + `mysql/2026_11_17_000002_mysql_procedure_steps.php`; `Clinical/Models/ProcedureStepSet.php`, `ProcedureStep.php`; `CatalogController` (`PUT /api/procedure-catalog/{code}/kind`, `PUT /api/procedure-catalog/{code}/steps {valid_from, steps[]}`; izin `tariff.manage`, diaudit). `GET /api/procedure-catalog` menambah `kind` dan langkah aktif.
- Tariffs: migrasi `2026_11_17_000003_tariff_package_rule.php` + grant; `Tariffs/Models/TariffPackageRule.php`, `TariffPackageInstalment.php`; `PUT /api/tariffs/package-rule {procedure_code, valid_from, mode, dp_percent?, instalments?}`; `Tariffs/Contracts/PackageTerms.php` + `Services/PackageTermsService.php` (mengembalikan syarat lengkap atau "belum lengkap" dengan sebabnya). `price-list` menambah ringkasan paket.
- Layar (TK06, TK07): `frontend/src/modules/settings/ClinicSettingsPage.tsx` (PriceTab menjadi "Tindakan dan harga"), baru `settings/ProcedureForm.tsx`, `settings/VisitStepsEditor.tsx`, `settings/api.ts`. Status "Perlu diisi" dihitung dari: tanpa harga, `multi` tanpa kunjungan, tanpa aturan tagih, jumlah cicilan ≠ jumlah kunjungan, total cicilan ≠ harga.
- Tes dulu:
  - `tests/Modules/Clinical/ProcedureStepsTest.php`: `versi_baru_tidak_mengubah_versi_lama`, `multi_minimal_dua_kunjungan`, `hanya_pemilik`, `update_delete_ditolak_trigger`, `tenant_lain_404`.
  - `tests/Modules/Tariffs/PackageRuleTest.php`: `cicilan_wajib_sama_dengan_harga_paket` (422 bila beda), `dp_persen_1_sampai_99`, `kode_berpaket_menolak_tingkat_kedua_dan_sel_band`, `harga_berubah_tanpa_aturan_baru_menjadi_belum_lengkap`, `versi_lama_tetap`.
  - `ClinicSettingsPage.test.tsx`: tombol "Bagi rata" hanya mengisi formulir (tidak tersimpan sampai pemilik menekan Simpan); penghitung "Perlu diisi"; teks "Paket yang sedang berjalan tidak berubah".
- Risiko: (uang) dua simpanan terpisah (jenis di Clinical, aturan di Tariffs) bisa setengah jadi; itu sengaja terbaca "Perlu diisi", bukan ditebak. (tenant) tiga tabel baru masuk tes arsitektur dan `MysqlGrantsTest`.
- TIDAK dikerjakan: saran jadwal dari durasi/jeda (hanya disimpan), kode baru di luar daftar ICD-9-CM (behel, pemutihan: perlu dicek), komponen, impor CSV.

### T3. Paket berjalan di kunjungan dokter + tagihan DP / lunas / cicil
- Clinical: migrasi `2026_11_18_000001_treatment_course.php` + mysql; `Clinical/Models/TreatmentCourse.php`; `Clinical/Domain/CourseStatus.php` (transisi); `Clinical/Events/CourseStarting.php`; `ProcedureRecorded` + `courseId`, `courseStep`; `Http/Controllers/CourseController.php` (`POST /api/visits/{id}/courses`, izin `note.sign`); `ProcedureController` (`tooth-entries` menerima `course_id`, server mengisi langkah berikutnya; kode `multi` di luar paket ditolak); `ChartController` (daftar paket berjalan pasien); paket menjadi `selesai` saat langkah terakhir final.
- Billing: migrasi `2026_11_18_000003_patient_package.php` (+ `invoice_line.procedure_id` boleh kosong, kolom paket) + mysql; `Billing/Models/PatientPackage.php`, `PackageSchedule.php`; `Listeners/PackageFromCourse.php` (kunci harga, jadwal, baris DP/lunas di tagihan kunjungan itu); cabang paket di `Listeners/InvoiceFromProcedure.php`; periksa pemakai `procedure_id`: `Listeners/InvoiceGuard.php`, `Services/Ledger.php`, `Services/IntegrityFactsService.php`, `Http/Controllers/CreditNoteController.php`; `GET /api/visits/{id}/billing-preview` (izin `price.view` atau `billing.read`).
- Layar: `clinical/kasir/CatalogPanel.tsx` ("Paket berjalan pasien ini", TK04), `CartPanel.tsx` ("Yang ditagih hari ini", "Nilai paket berjalan"), dialog konfirmasi "Mulai paket: DP Rp X ditagih sekarang"; `billing/InvoicePage.tsx` panel paket hanya-baca (TK09), `billing/KasirPage.tsx` nama baris.
- Tes dulu:
  - `tests/Modules/Clinical/TreatmentCourseTest.php`: `mulai_paket_hanya_dokter`, `pengaturan_belum_lengkap_422_dan_tidak_ada_baris`, `langkah_ditentukan_server_dan_berurutan`, `kode_multi_di_luar_paket_ditolak`, `langkah_terakhir_menutup_paket`, `sidik_tanda_tangan_lama_tetap_valid`, `paket_pasien_tenant_lain_404`.
  - `tests/Modules/Billing/PackageBillingTest.php`: `dp_ditagih_saat_mulai_sebelum_selesai`, `pelunasan_di_langkah_terakhir_sama_dengan_harga_kurang_dp`, `lunas_di_depan_lalu_semua_langkah_rp0`, `cicilan_per_langkah_sesuai_isian_pemilik`, `harga_dan_aturan_berubah_setelah_mulai_tidak_mengubah_paket`, `event_dua_kali_tidak_menagih_dua_kali`, `jumlah_semua_baris_sama_dengan_harga_terkunci`, `penjaga_tutup_kunjungan_lolos_dengan_baris_rp0_paket`, `baris_rp0_paket_bukan_anomali_di_laporan_integritas`.
  - `Chart.test.tsx`, `InvoicePage.test.tsx`: keadaan TK04 dan TK09.
- Risiko: (uang, tertinggi) tagihan DP muncul sebelum catatan ditandatangani; salah ketuk = uang tertagih, maka wajib dialog konfirmasi dan T4. "Sudah dibayar" per paket hanya bisa diturunkan dari status tagihan (belum ada alokasi bayar per baris); tampilkan "Ditagih / Lunas" per tagihan, jangan angka yang dikarang. (klinis) memulai paket bukan catatan klinis bertanda tangan; tiap langkah tetap draf sampai Selesai. (tenant) `course_id` dari klien divalidasi milik pasien dan tenant ini.
- TIDAK dikerjakan: hentikan paket (T4), komponen (T5), tingkat/band untuk paket, pindah gigi atau ganti dokter paket, alokasi pembayaran per baris, bagi hasil.

### T4. Hentikan paket di Kasir
- Billing: migrasi `2026_11_19_000001_patient_package_stop.php` + mysql; `Billing/Models/PatientPackageStop.php`; `Http/Controllers/PackageController.php` (`POST /api/packages/{id}/stop {reason}`, izin `billing.adjust`, alasan ≥10 huruf, diaudit); aturan di `CreditNoteController` dan `InvoiceController::adjust`: dokumen pada baris ber-`package_id` selalu menunggu pemilik (`billing.approve_reversal`); muncul di `GET /api/billing/reversals/pending`.
- Clinical: `Clinical/Contracts/CourseDirectory.php` + `Services/CourseDirectoryService.php` (`markStopped`: hanya status + alasan + audit, tanpa isi klinis).
- Layar: `billing/InvoicePage.tsx` (tombol "Hentikan paket", tampil "sisa yang belum ditagih" sebagai informasi, bukan utang), `billing/ReversalApprovals.tsx`.
- Tes dulu: `tests/Modules/Billing/PackageStopTest.php`: `kasir_menghentikan_dengan_alasan`, `setelah_henti_jadwal_tersisa_tidak_pernah_ditagih`, `dokter_tidak_bisa_menambah_langkah_paket_berhenti`, `nota_kredit_sebagian_pada_baris_paket_menunggu_pemilik`, `penagihan_sisa_menunggu_pemilik`, `tidak_ada_angka_refund_otomatis`, `henti_dua_kali_409`; `tests/Modules/Clinical/RoleAccessTest.php`: kasir tetap tanpa akses klinis.
- Risiko: (uang) penagihan sisa memakai penyesuaian `correction` yang menambah saldo tagihan lama; tagihan yang sudah lunas menjadi terbuka lagi, harus terlihat jelas di Kasir. (klinis) kasir menghentikan perawatan secara administrasi; lihat Q-25.
- TIDAK dikerjakan: rumus refund, melanjutkan lagi paket yang dihentikan, pindah sisa ke paket lain.

### T5. Komponen + kuota + tagih di atas kuota
- Inventory: migrasi `2026_11_20_000001_material.php` + mysql; `Inventory/Models/Material.php`, `MaterialPrice.php`; `Http/Controllers/MaterialController.php` (`GET/POST /api/materials`, `PUT /api/materials/{id}/price`, pemilik); `Inventory/Contracts/MaterialDirectory.php`.
- Tariffs: migrasi `2026_11_20_000003_tariff_package_component.php`; `PUT /api/tariffs/package-components {procedure_code, valid_from, step_seq, items[]}`; `PackageTerms` menambah komponen (nama, satuan, harga satuan pada tanggal itu); `config/modules.php`: `Tariffs` → `Inventory`.
- Billing: migrasi `2026_11_20_000005_package_component.php` (+ kolom `invoice_line`); salinan komponen di `PackageFromCourse`; baris "di atas kuota" di `InvoiceFromProcedure` saat langkahnya final: `(qty − free_qty) × harga satuan`.
- Layar: `settings/ComponentsEditor.tsx` (TK08), tab "Bahan" di `ClinicSettingsPage.tsx`; baris bahan di `CartPanel.tsx` dan `InvoicePage.tsx`. Teks bantuan TK08 diganti: "Jumlah ditetapkan pemilik; dokter tidak mengubahnya saat kunjungan."
- Tes dulu: `tests/Modules/Inventory/MaterialTest.php` (`hanya_pemilik`, `harga_berversi`, `tenant_lain_404`); `tests/Modules/Tariffs/PackageComponentTest.php` (`gratis_semua`, `gratis_sampai_n`, `bahan_tenant_lain_ditolak`); `tests/Modules/Billing/PackageComponentBillingTest.php` (`di_atas_kuota_ditagih_selisih_kali_harga`, `gratis_semua_tanpa_baris`, `harga_bahan_terkunci_saat_mulai`, `paket_yang_dimulai_sebelum_komponen_diatur_tidak_berubah`, `tidak_ada_api_dokter_mengubah_jumlah`, `tidak_ditagih_dua_kali`); `tests/Feature/ModuleBoundaryTest.php` (sisi baru).
- Risiko: (uang) jumlah tetap berarti bahan ditagih walau pemakaian nyata berbeda; itu keputusan pemilik, tulis jelas di layar pengaturan. (tenant) FK gabungan ke `material`.
- TIDAK dikerjakan: stok dan pengurangan stok, kode KFA untuk bahan, komponen untuk tindakan tunggal (Q-24), dokter mengubah jumlah.

## 6. Yang perlu dicek (bukan keputusan kita)
- Perlakuan pajak/pembukuan uang muka dan aturan pengembalian uang muka ke pasien: perlu dicek dengan konsultan pajak/hukum klinik; belum ada sumber yang dibaca.
- Kode ICD-9-CM untuk behel dan pemutihan: perlu dicek di daftar resmi SATUSEHAT ICD9CM_2010 (pola `IcdCatalog::icd9cmExists`).
- Apakah paket yang berjalan perlu dikirim ke SATUSEHAT sebagai rencana perawatan: perlu dicek di dokumentasi use case Gigi; di luar cakupan ini.

## 7. Pertanyaan untuk pemilik (maks 5)
- **Q-22 Salah mulai paket.** Dokter salah menekan "Mulai paket" dan DP belum dibayar: boleh dokter membatalkannya sendiri saat itu juga, atau tetap lewat kasir + persetujuan pemilik seperti paket berhenti?
- **Q-23 Harga paket per dokter.** Rencana ini: satu harga paket untuk semua dokter (tanpa harga Spesialis/bidang/per dokter). Benar begitu, atau paket juga perlu harga berbeda untuk spesialis?
- **Q-24 Komponen untuk tindakan tunggal.** Bahan + kuota hanya untuk kunjungan paket (seperti TK08), atau juga untuk tindakan tunggal?
- **Q-25 Siapa yang menghentikan paket.** Cukup kasir (lalu pemilik menyetujui uangnya), atau dokter yang merawat juga harus mengonfirmasi bahwa perawatan dihentikan?
- **Q-26 Bagi hasil dokter untuk paket.** Baris DP dicatat atas nama dokter yang memulai paket. Bila kunjungan berikutnya dikerjakan dokter lain, bagi hasil mengikuti siapa: pemulai, pelaksana tiap kunjungan, atau diatur pemilik per paket?

## 8. Perubahan setelah jawaban Q-22 sampai Q-26 (16 Nov 2026)
Jawaban lengkap di `docs/decisions.md`. Dampak ke tahap (T1 tidak berubah):
- **T2 (Q-23):** butir 4 bagian 4 ("paket satu harga Umum untuk semua dokter") **batal**. Perlu grup dokter: harga tindakan per grup, atau naik/diskon x% dari harga dasar, plus aksi massal naik x%. Rancang dulu: grup = konsep baru atau memakai band + `tariff_rule` yang sudah ada; dan bagaimana rupiah cicilan per kunjungan mengikuti harga grup (jumlah cicilan wajib = harga paket yang terkunci untuk grup itu). Belum diputuskan.
- **T3 (Q-22):** tambah "Batalkan mulai paket" oleh dokter selama belum ada pembayaran pada baris DP/lunas; tes: sesudah ada pembayaran ditolak dan diarahkan ke kasir.
- **T4 (Q-25):** hentikan paket = kasir mengajukan → dokter yang merawat mengonfirmasi → pemilik menyetujui uang. Tes: tanpa konfirmasi dokter, paket belum berhenti.
- **T5 (Q-24):** komponen juga untuk tindakan tunggal (jumlah tetap dari pemilik; di atas kuota ditagih bersama baris tindakannya).
- **T6 baru (Q-26):** templat bagi hasil per tindakan/paket di modul Compensation, termasuk "setelah dipotong bahan". Di luar lima tahap awal.
