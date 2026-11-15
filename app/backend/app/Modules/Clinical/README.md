# Modul Clinical (kunjungan, catatan SOAP, odontogram, persetujuan, koreksi)

Akses (U0d): pemilik hanya **membaca** (`note.read`); tidak pernah menulis draf, menandatangani, atau mengoreksi. Setiap baca chart/baseline/riwayat medis tercatat di `audit_event` (aktor, waktu, `entity_id` = pasien, jenis data; tanpa isi). Kasir tidak punya akses klinis.

## Saran kode ICD (usulan)

`GET /api/coding-suggestions?condition=&tooth=&surface=&visit_id=` (izin `note.write`) mengembalikan 1–3 kode ICD-10 (+ ICD-9-CM) dari `coding_rule`. Pemetaan di `Domain/CodingTemplate.php` adalah **usulan/contoh**, bukan standar nasional; perlu ditinjau dokter gigi atau petugas rekam medis. Teks DISPLAY = teks resmi bahasa Inggris dari tabel ICD. Dokter tetap memilih kode; sistem tidak mengisi `diagnosis_code` sendiri. Lihat DEVIATIONS #42.

## Cek saat tanda tangan

`POST /api/visits/{id}/sign` memeriksa draf temuan, draf tindakan, dan kode SOAP sebelum mengunci (`Domain/SignCheck.php`). **Blokir** (422 `sign_blocked`): tindakan pada gigi yang sudah hilang, 23.01 pada gigi tetap atau 23.09/23.19 pada gigi sulung, permukaan tidak cocok. **Peringatan** (422 `warnings`): tindakan tanpa diagnosis, atau diagnosis yang jarang sejalan dengan tindakan (aturan **usulan**, sekarang K02.0 + 23.70/23.71). Dokter tetap bisa menandatangani dengan `accept_warnings: true` + `reason` (min. 10 karakter); alasan dicatat di audit. Lihat DEVIATIONS #44.

## Temuan vs tindakan (DEVIATIONS #47)

- `tooth_finding` = **kondisi visual** (karies, hilang, perlu dicabut, ...) per gigi / satu permukaan. API temuan menolak kode tindakan dan status tindakan (422).
- `procedure_record` = **tindakan** (setara `procedurelog` Open Dental): satu baris = satu tindakan = satu harga, berapa pun permukaannya (`surfaces` = `MOD`, urutan M O D I B L). `treat_area` dari katalog klinis `procedure_definition` (`Domain/ProcedureCatalog.php`, bukan Tariffs).
- API: `POST /api/visits/{id}/procedures` (draf; `surfaces` boleh string atau array; `provider_id` default dokter kunjungan), `PATCH /api/procedures/{id}` (draf sendiri), `DELETE /api/procedures/{id}` (state `discarded`), `POST /api/procedures/{id}/status` (dokter gigi, baris final baru + `supersedes_id`).
- Status (`Domain/ProcedureStatus.php`): kunci Indonesia tetap + `cancelled` (dari `direncanakan`) + `superseded` (hanya penanda dari jalur ganti, unit 3). `external` = alias tulis `ada_di_tempat_lain`. Matriks di `TRANSITIONS`; `selesai` final.
- **Tagihan**: hanya tindakan final `selesai` dengan kode memicu `ProcedureRecorded` (tanpa harga; membawa `provider_id` + kategori/bidang dokter itu). Billing membuat satu `invoice_line` per `procedure_id` (UNIQUE). EC/EO/R/Cn/rencana/batal tidak pernah menagih; `ada_di_klinik_ini` = pekerjaan **lama** di klinik ini.
- Tanda tangan memfinalkan draf temuan **dan** draf tindakan kunjungan itu, lalu menagih tindakan `selesai`.

## Tindakan klinik lain (`external`, DEVIATIONS #48)

- Status `ada_di_tempat_lain` (alias tulis `external`) **wajib** `external_clinic_name` (maks. 120) + `external_date` perkiraan: `2025` (tahun), `2025-06` / `06/2025` (bulan), `12/06/2025` / `2025-06-12` (hari). Disimpan sebagai tanggal (hari pertama bulan/tahun bila kasar) + `external_date_precision` `day|month|year` (`Domain/ApproxDate.php`). Tanggal mustahil atau setelah hari ini (zona waktu cabang) = 422. Status lain yang mengirim kolom ini = 422.
- **Tidak pernah menagih**, juga bila berkode dan sudah ditandatangani. Audit buat/ubah mencatat nama klinik + tanggal + presisi + status konfirmasi (tanpa harga).
- **Tolak (422 `external_same_surface`, tidak bisa dikonfirmasi):** gigi/permukaan yang sama dengan tindakan `selesai` (draf atau final) pasien ini pada hari kalender kunjungan (zona waktu cabang, default Asia/Jakarta). Sama = permukaan yang sama, atau seluruh gigi vs permukaan pada gigi itu; rentang/kuadran/rahang/mulut dihitung per gigi (`Domain/ProcedureSite.php`).
- **Perlu konfirmasi (`external_confirmation = pending`):** pasien sudah punya tindakan `selesai` hari itu, lalu dokter tetap mencatat tindakan klinik lain di tempat lain di mulut. Baris pending/ditolak **bukan riwayat aktif**: tidak masuk `procedures` di chart, tidak dicat di odontogram, tidak bisa ganti status (409), tetap tidak menagih.
- **Tanpa konfirmasi (`not_required`):** pemeriksaan awal, riwayat, ERM — kunjungan tanpa `selesai` hari itu. Langsung aktif.
- Konfirmasi: `POST /api/procedures/{id}/confirm-external {confirm, reason?}` dan daftar `GET /api/procedures/pending-external` (cabang aktif, tanpa diagnosis), izin `procedure.confirm_external` = **front_desk dan assistant saja**: mata kedua ketika tindakan klinik lain dicatat pada kunjungan yang sudah ada pekerjaan yang (akan) ditagih hari itu, supaya pekerjaan hari ini tidak tersembunyi dari tagihan. Dokter tidak (ia yang mencatat), kasir tidak, pemilik **belum** (keputusan terbuka). Tolak = `rejected` (tanpa DELETE). Keduanya diaudit. Konfirmasi ditolak 422 bila sejak dicatat situs itu mendapat `selesai` hari itu. Baris final pending hanya boleh mengubah kolom konfirmasi, sekali (trigger MySQL).

## Riwayat tindakan, ganti, koreksi, per tanggal (DEVIATIONS #49)

- Baris final tidak pernah diubah. Tiga cara menulis riwayat, semuanya baris final baru, hanya dokter (`note.sign`):
  - **Ubah status** `POST /api/procedures/{id}/status` (unit 1): baris baru `supersedes_id`, hanya sepanjang `TRANSITIONS`.
  - **Ganti restorasi** `POST /api/procedures/{id}/replace {visit_id, status direncanakan|selesai, reason, kode + situs}`: untuk pekerjaan yang sudah ada (`selesai`, `ada_di_klinik_ini`, `ada_di_tempat_lain`). Penanda `superseded` (salinan lama, `supersedes_id`) + tindakan baru (`replaces_id` = lama). Tagihan lama tetap; yang baru menagih bila `selesai`.
  - **Koreksi** `POST /api/procedures/{id}/corrections {reason, field yang dikoreksi}`: status sama, `supersedes_id`, tidak menagih. Belum memakai `correction_request`/2x24 jam.
- Alasan wajib ≥10 huruf untuk ganti dan koreksi (kolom `reason`).
- Chart: `procedures` = baris final terkini (tidak digantikan, bukan penanda, bukan luar pending/ditolak). `procedure_history` = semua baris final yang berlaku, dengan `superseded_by` + `change` (`digantikan`/`koreksi`/`status`, diturunkan).
- `GET /api/patients/{id}/chart?as_of=YYYY-MM-DD`: akhir hari lokal cabang. Waktu berlaku = `finalized_at` (luar terkonfirmasi: yang lebih akhir dengan `external_confirmed_at`), bukan `external_date`. Masa depan = sekarang; kosong/salah = 422. Draf dan antrean konfirmasi kosong. Diaudit (`baca` chart, `as_of`).
- UI bot masih memegang: slider tanggal, linimasa, panel riwayat per gigi.

## Tutup kunjungan (unit 4, DEVIATIONS #50)
- `POST /api/visits/{id}/close {reason?}` dan janji → `done` (listener `CloseVisitOnAppointmentDone`) memakai `Services\VisitCloser`.
  Penjaga tagihan dijawab Billing lewat event `VisitClosing` (Clinical tidak bergantung pada Billing). Izin `appointment.transition`.
- Walk-in: `POST /api/visits/{id}/cancel-attendance {reason}` (hanya `appointment_id` NULL); kunjungan dari janji dibatalkan lewat status janji.

## Backlog (belum dibuat)

- TODO: audio dikte dihapus setelah catatan ditandatangani; transkrip + diff draf-vs-final (draf agen vs versi bertanda tangan) disimpan ke audit.

Aturan: kode baru diletakkan di sini (`Models/`, `Http/`, `Services/`, `Domain/`, `Routes/routes.php`, `Contracts/`, `Events/`). Modul lain hanya boleh memakai `Contracts/` atau `Events/` modul ini, dan hanya jika sisi (edge) tercantum di `config/modules.php`.
