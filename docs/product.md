# Produk: Bittodent Berbasis Agen AI (draf 1)

*Status: draf 2, 14 Nov 2026 (cakupan MVP diperbarui setelah jawaban Jerome). Belum ada kode. Semua fakta pesaing ditautkan ke halaman resminya; yang belum dicek ditandai "perlu dicek".*

## Ringkasan
Sistem klinik gigi berbasis cloud untuk Indonesia. **Cloud** artinya aplikasi berjalan di server internet, jadi klinik cukup pakai browser. Bedanya dengan software klinik biasa: pekerjaan administrasi (pendaftaran, pengingat, klaim, tagihan) dikerjakan oleh **agen AI**, yaitu program yang bisa menjalankan tugas sendiri dalam batas yang kita tentukan. Semua hasil klinis dari agen tetap **draf** sampai dokter gigi berizin menyetujuinya.

Urutan prioritas setiap keputusan: keamanan & privasi → keselamatan klinis & keutuhan data → regulasi → produk/UX/agen.

## Peta modul

| # | Modul | Isi singkat | Fase |
|---|---|---|---|
| 1 | Pendaftaran pasien | Data identitas (minimal no. RM, nama, NIK) dan data sosial, sesuai Permenkes 24/2022 Pasal 14. Persetujuan pemrosesan data (UU PDP). | **MVP** |
| 2 | Jadwal & kursi/ruang | Kalender per dokter dan per kursi (*operatory* = ruang/kursi tindakan), daftar tunggu, blokir jam. | **MVP** |
| 3 | Odontogram | Peta gigi pasien. Mengikuti formulir odontogram standar Indonesia dan use case "Gigi" SATUSEHAT (lihat compliance.md). | **MVP** |
| 4 | Rencana perawatan & persetujuan | Rencana tindakan + biaya, persetujuan tindakan (*informed consent*) tertulis/lisan sesuai UU 17/2023 Pasal 293. | **MVP** |
| 5 | Catatan SOAP | Catatan kunjungan format **SOAP** (Subjektif, Objektif, Analisis, Perencanaan). Wajib nama, waktu, tanda tangan nakes. | **MVP** |
| 6 | Charting periodontal | Pencatatan kedalaman poket gusi per gigi. | Nanti |
| 7 | Rontgen/foto | Unggah & lihat foto intraoral dan rontgen, terhubung ke odontogram. Integrasi alat rontgen (DICOM = format standar gambar medis). | MVP: unggah file. Nanti: integrasi alat |
| 8 | Resep | Resep obat dengan kode **KFA** (Kamus Farmasi dan Alat Kesehatan dari Kemenkes). | **MVP** |
| 9 | Kasir, tagihan & asuransi | Tagihan umum, asuransi swasta, dan BPJS Kesehatan. | **MVP**: pasien umum + asuransi swasta. **BPJS: nanti** (model data sudah siap BPJS, lihat D-008) |
| 10 | Inventaris | Stok bahan & alat, peringatan stok menipis. | Nanti |
| 11 | Recall & pengingat | Pengingat kontrol rutin dan janji temu via WhatsApp. | **MVP** (pengingat janji dan recall, D-011) |
| 12 | Multi-cabang | Satu tenant (pemilik/klinik) bisa punya banyak cabang; akses, jadwal, stok, dan laporan per cabang. | **MVP**: struktur tenant → cabang, akses per cabang, pindah cabang. Nanti: laporan gabungan lanjutan, transfer stok antar-cabang |
| 13 | Laporan | Kunjungan, pendapatan, tindakan, laporan wajib ke dinas/Kemenkes. | MVP: laporan dasar. Nanti: dashboard |
| 14 | Sinkron SATUSEHAT | Kirim data kunjungan ke platform Kemenkes (FHIR R4). | **MVP** (wajib, lihat compliance.md) |

## Target klinik & mode
Kami melayani tiga ukuran klinik sekaligus (D-007):
- **Praktik mandiri (1–2 kursi)** → **mode sederhana**: satu cabang, menu ringkas, peran bisa digabung (misal dokter merangkap pemilik), pengaturan minimal.
- **Klinik 2–5 kursi** → mode standar: peran terpisah, jadwal per kursi.
- **Multi-cabang** → satu tenant dengan banyak cabang, pemilik melihat semua cabang.

Satu model data untuk semuanya: mode sederhana hanya menyembunyikan fitur, bukan sistem terpisah. Klinik bisa naik kelas tanpa migrasi.

## Ringkasan cakupan MVP
**Masuk MVP:** pendaftaran, jadwal + kursi + daftar tunggu, odontogram, rencana perawatan & persetujuan, catatan SOAP (scribe suara sebagai draf, sesuai D-009), unggah rontgen/foto, resep (KFA), kasir umum + asuransi swasta, pengingat janji dan recall kontrol rutin via WhatsApp (D-011), struktur multi-cabang, laporan dasar, sinkron SATUSEHAT, mode sederhana.
**Belum MVP:** BPJS (model data disiapkan), charting periodontal, inventaris, integrasi alat rontgen, laporan gabungan lanjutan.

Cerita pengguna, kriteria penerimaan, dan alur MVP: lihat [user-stories.md](user-stories.md).

## Pembanding: Curve Dental dan Open Dental
Hanya fitur yang tertulis di halaman resmi mereka (dicek 14 Nov 2026). Kedua produk dibuat untuk pasar AS.

| Area | Curve Dental | Open Dental |
|---|---|---|
| Jadwal | Drag-and-drop, tampilan per operatory/provider, isi slot batal ([scheduling](https://www.curvedental.com/dental-scheduling-software)) | Penjadwalan online pasien "Web Sched" ([websched](https://www.opendental.com/site/websched.html)) |
| Charting gigi | Charting berwarna, shortcut tindakan ([charting](https://www.curvedental.com/dental-charting-software)) | — (tidak dicek) |
| Perio | Tampilan grafik & tabel ([perio](https://www.curvedental.com/perio-charting)) | Perio chart, bandingkan hingga 6 pemeriksaan terakhir ([manual perio](https://www.opendental.com/manual/perio.html)) |
| Rencana perawatan | Tanda tangan elektronik pasien ([treatment plan](https://www.curvedental.com/treatment-plan)) | — (tidak dicek) |
| Formulir & consent | — | Formulir intake, riwayat medis, consent lewat tablet/web "eClipboard" ([eclipboard](https://www.opendental.com/site/eclipboard.html)) |
| Imaging | Imaging bawaan, overlay rontgen di chart ([imaging](https://www.curvedental.com/dental-image-software)) | — (halaman manual imaging 404 saat dicek) |
| Resep | ePrescribe dengan data PDMP (sistem AS) ([eprescribe](https://www.curvedental.com/eprescribe)) | eRx hanya berlaku di AS ([eRx](https://www.opendental.com/site/electronicrx.html)) |
| Pengingat | Pengingat SMS/email otomatis, two-way texting ([engagement](https://www.curvedental.com/dental-patient-engagement-software)) | eReminders & eConfirmations via SMS/email ([ereminders](https://www.opendental.com/site/ereminders.html)) |
| Billing/klaim | Verifikasi asuransi AS berbasis AI ([billing](https://www.curvedental.com/dental-billing-software)) | — (tidak dicek) |
| Multi-lokasi | Halaman khusus multi-lokasi/DSO ([multi-location](https://www.curvedental.com/multi-location-practice)) | Fitur "Clinics": banyak lokasi, satu database, user dibatasi per klinik ([manual clinics](https://www.opendental.com/manual/clinics.html)) |
| Laporan | Laporan kustom, dashboard ([reports](https://www.curvedental.com/dental-report-software)) | — (tidak dicek) |
| Cloud | Berbasis cloud ([multi-location](https://www.curvedental.com/multi-location-practice)) | "Open Dental Cloud" hanya untuk pelanggan AS, rilis terbatas, backup terenkripsi diuji tiap malam ([cloud](https://www.opendental.com/site/opendentalcloud.html)) |
| AI | "Curve+ AI Suite": AI klinis untuk dokumentasi, AI penagihan, AI engagement ([ai](https://www.curvedental.com/ai)) | — (tidak dicek) |

**Celah yang bisa kita isi:** keduanya tidak menyebut SATUSEHAT, BPJS, KFA, odontogram standar Indonesia, atau WhatsApp di halaman yang dicek. Ini ciri pasar AS, bukan kekurangan mereka; tapi itu ruang kita.

## Acuan UI/UX
Jerome memilih **Zendenta** karya Fikri Studio sebagai acuan tampilan dan alur ([fikristudio.com/project/zendenta](https://fikristudio.com/project/zendenta)). Yang kita ambil sebagai inspirasi (sesuai yang ditampilkan di halaman tersebut):
- Gaya bersih dan sederhana, palet warna medis yang segar.
- Penjadwalan janji temu yang cepat, dengan **daftar tunggu** (*waitlist*).
- Pencatatan pemeriksaan dalam **4 langkah**: informasi, rencana perawatan, hasil pemeriksaan mulut, persetujuan.
- Daftar pasien, jadwal staf, inventaris.
- Modul penjualan dengan **"kantong" uang** (akun terpisah, misal kas bebas dan dana perawatan) dan transfer antar-kantong.

**Catatan penting:** Zendenta adalah karya klien perusahaan lain. Kita hanya mengambil inspirasi pola dan rasa; **jangan menyalin** desain, aset, ikon, atau teks mereka.

**Yang harus kita tambahkan di luar Zendenta:**
1. Odontogram mengikuti standar formulir Indonesia.
2. Alur BPJS Kesehatan (setelah MVP; model data disiapkan sejak awal, D-008).
3. Sinkron SATUSEHAT.
4. Langkah **persetujuan dokter gigi** untuk setiap draf dari agen AI (langkah ke-5 di alur pemeriksaan, sebelum catatan dikunci).

## Prinsip produk
- Agen menghemat waktu admin; dokter tetap pemegang keputusan klinis.
- Tidak ada data pasien asli di demo, uji, atau dokumen. Pakai data sintetis.
- Kami tidak mengklaim sertifikasi atau kepatuhan apa pun sebelum ada bukti resmi.
