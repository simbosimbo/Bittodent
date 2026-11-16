# KlinikMe: alur pasien gigi dibanding alur Bittodent

Tanggal: 2026-11-16. Tujuan: belajar pola UX yang konkret, **bukan menyalin**.

## Sumber dan cara membaca kutipan

- **PDF**: buku panduan resmi KlinikMe (`Registrasi.pdf`, `Rekam Medis.pdf`, `Billing.pdf`, `Pengaturan.pdf`). Nomor halaman = halaman file PDF. Nomor yang tercetak di kaki halaman = halaman PDF dikurangi 1.
- **JS**: kode front-end publik KlinikMe (Next.js), disingkat:
  - `norm` = `gigi__norm_-*.js` (halaman rekam medis gigi, `/klinikme/rekammedis/gigi/[norm]`)
  - `odonto` = `gigi_odontogram__noreg_-*.js` (`/klinikme/rekammedis/gigi/odontogram/[noreg]`)
  - `edit` = `gigi_edit__noreg_-*.js`, `list` = `gigi-*.js`, `routes` = `routes.txt`
- Panduan memakai data contoh. Dokumen ini tidak memuat nama atau data pasien.
- "Tidak ditemukan di dokumen" = tidak ada di PDF maupun JS yang dibaca. Itu bukan berarti fiturnya tidak ada.

## Ringkasan alur KlinikMe

Registrasi (front desk) → antrean → halaman rekam medis dengan 4 tab: **Rekam Medis** (riwayat), **Catatan Klinik**, **Diagnosa & Tindakan**, **Resep** → tombol **Selesai** → tagihan muncul di Billing → kasir bayar.

Di dalam "Diagnosa & Tindakan" ada sub-tab **Kondisi** (odontogram), **Diagnosa**, **Tindakan**, **Pemakaian Alkes** (Rekam Medis.pdf hal. 9–12).

---

## Langkah 1. Pasien datang (registrasi)

- **Siapa**: front desk. Tidak ada aturan peran yang tertulis. Akses diatur per pegawai lewat centang fitur (lihat bagian Hak akses).
- **Layar**: `/klinikme/registrasi/registrasipasien` dan `/klinikme/registrasi/v2/registrasi-pasien` (routes). Dua tab: **Pasien Baru** dan **Pasien Lama** (Registrasi.pdf hal. 2–4).
- **Pasien baru, field wajib (bertanda \*)**: Nama Lengkap (dengan sapaan), Jenis Kelamin, Tgl. Lahir, Umur (otomatis th/bl/hr), Nomor KTP, Alamat Lengkap, lalu **Layanan Klinik**: Grup Pasien, Jenis Pelayanan, Ruang Pemeriksaan, Dokter Pemeriksa. Kira-kira **10 field wajib** + tombol Scan KTP + Simpan (Registrasi.pdf hal. 2).
- KTP wajib. Untuk anak <17 tahun tanpa KTP, data keluarga wajib di "Detail Data" (Registrasi.pdf hal. 2).
- "Detail Data" (foto, kontak, alamat rinci, status kawin, dll.) tidak wajib (Registrasi.pdf hal. 2).
- No. Registrasi dan No. RM dibuat otomatis (Registrasi.pdf hal. 2, label "Otomatis").
- **Pasien lama**: cari nama / no. telepon / KTP / No. RM → klik **Registrasi** → cukup isi 4 field Layanan Klinik → Simpan. Jadi sekitar **3 klik + 4 pilihan** (Registrasi.pdf hal. 3–4).
- Setelah simpan, pasien otomatis masuk **Daftar Antrian Pasien** di panel kanan. Isinya No. Registrasi, Grup Pasien (Umum/BPJS/...), nama, dokter (Registrasi.pdf hal. 4).
- Keluhan **tidak** diisi di registrasi. Form registrasi tidak punya field keluhan (Registrasi.pdf hal. 2, 4).

## Langkah 2. Keluhan / anamnesis

- **Siapa**: tidak ditulis. Tab ini ada di halaman rekam medis, jadi diisi oleh siapa pun yang punya akses "Rekam Medis Gigi" (Pengaturan.pdf hal. 6). Front desk tidak mencatat keluhan saat registrasi.
- **Layar**: tab **Catatan Klinik** → sub-tab **Anamnesa Umum**, **Anamnesa Odontogram**, **Pemeriksaan Umum**, **Unggah Foto** (Rekam Medis.pdf hal. 7).
- **Anamnesa Umum**: Riwayat Penyakit, Keluhan Utama, Keluhan Tambahan, Penyakit Sistemik, Obat, Alergi (centang Debu/Makanan/Obat + keterangan) (Rekam Medis.pdf hal. 7, gambar).
- **Anamnesa Odontogram** (pemeriksaan ekstra-oral/intra-oral): Oklusi, Torus Palatinus, Torus Mandibularis, Palatum, Diastema, Gigi Anomali, Lain-lain (Rekam Medis.pdf hal. 7). API: `/rekam_medis/anamnesa_odonto…` (norm).
- **Pemeriksaan Umum**: nadi, tensi, suhu, berat, tinggi, pernapasan, mata, gigi & mulut, kulit (Rekam Medis.pdf hal. 8).
- **Wajib?** PDF: semua data Catatan Klinik "tidak bersifat wajib" (Rekam Medis.pdf hal. 7). JS: Keluhan Utama punya aturan `required:"Wajib Diisi"` dan minimal 10 karakter, tetapi **hanya di form cabang BPJS** (norm, `"BPJS"===Ft&&P … name:"KeluhanUtama",rules:{required:"Wajib Diisi"…"Minimal 10 karakter"`).
- **Tampil ke dokter di mana**: di tab yang sama dan di riwayat kunjungan (kolom `t.keluhan` di daftar riwayat, norm). Tidak ada ringkasan keluhan khusus di layar odontogram/tindakan: tidak ditemukan di dokumen.
- Ada juga format SOAP/CPPT (`Subjektif`, `Objektif`, `Plan`, route `/gigi/cppt/[noreg]`) (norm, routes).

## Langkah 3. Dokter bekerja (membuka pasien)

- **Siapa**: dokter (atau perawat) mengklik pasien di Daftar Antrian → langsung ke halaman rekam medis (Registrasi.pdf hal. 4).
- **Layar**: `/klinikme/rekammedis/gigi/[norm]` (routes, norm). Header menampilkan nama, tgl registrasi, no. registrasi, no. RM, dokter (Rekam Medis.pdf hal. 7).
- Tab pertama **Rekam Medis** = daftar kunjungan lalu (tgl, jenis pelayanan, diagnosa utama, dokter) + "Lihat Detail" (Rekam Medis.pdf hal. 7).
- Riwayat dibuka per kunjungan. Riwayat gigi gabungan per gigi: tidak ditemukan di dokumen.
- Banyak form tambahan per pasien (`[norm]`): asesmen awal, pra tindakan, pra sedasi, anestesi, general/informed consent, surgical safety, kajian resep, edukasi pasien, pemesanan protesa (routes). Semua opsional menurut PDF (Rekam Medis.pdf hal. 18, untuk modul kecantikan; modul gigi tidak menjelaskan).

## Langkah 4. Dokter mencatat tindakan → odontogram

**Inti temuan: di KlinikMe odontogram TIDAK terisi dari tindakan. Arahnya terbalik: kondisi digambar dulu, lalu tindakan boleh memilih gigi dari kondisi itu.**

### 4a. Kondisi (odontogram)

- **Layar**: sub-tab **Kondisi** → tombol "+ Tambah Kondisi" → halaman **Form Kondisi** `/klinikme/rekammedis/gigi/odontogram/[noreg]` (Rekam Medis.pdf hal. 9; routes).
- **Cara isi (digambar tangan)**: pilih simbol kondisi di menu kanan → klik gigi atau bagian gigi → konfirmasi. Panduan di layar: "Pilih Kondisi Gigi di menu kanan", "Tap/klik gigi atau bagian gigi dengan kondisi terpilih", "Pastikan Bagian Gigi yang Anda Pilih Benar", tombol "Benar" (odonto). Digambar di `<canvas>` (`odontogram-canvas-overlay`) dan disimpan sebagai gambar PNG + peta `{nomor gigi: kondisi}` (odonto, `Data:{Image:n,Odontogram:i}`).
- **Per kunjungan atau per pasien?** Disimpan **per kunjungan** (`NoRegistrasi`), juga membawa `NoRm` dan tanggal periksa. Jika sudah ada untuk noreg itu → `PUT` (ditimpa); jika belum → `POST` (odonto: `m="/rekam_medis/anamnesa_odontogram"…h=G.noreg?"PUT":"POST"`). Ada endpoint `…/anamnesa_odontogram/histori/` dan `…_v2/histori/` (norm). Apakah kondisi kunjungan lalu otomatis terbawa: tidak ditemukan di dokumen.
- **Permukaan gigi**: ATAS, BAWAH, KIRI, KANAN, TENGAH (5 bagian), juga label KACIP/GERAHAM (odonto). Ada panel "Riwayat" No/Deskripsi di kiri; teks "Data otomatis tersimpan & ditampilkan di sisi kiri" (odonto; Rekam Medis.pdf hal. 9).
- **Legenda kondisi** (terlihat di gambar, daftar bisa digulir, jadi mungkin lebih panjang): Gigi Normal, Gigi Tidak Ada, Tidak Erupsi, Erupsi Sebagian, Impaksi Terlihat, Impaksi Tidak Terlihat, Anomali, Gigi Renggang, Atrisi, Abrasi, Karies, Fraktur Mahkota, Gigi Non Vital, Sisa Akar (Rekam Medis.pdf hal. 9). Daftar tidak tertulis di JS, jadi kemungkinan diambil dari server. Daftar lengkap: tidak ditemukan di dokumen.
- **Skor**: kotak D-M-F → Skor DMF-T dan d-e-f → Skor def-T (Rekam Medis.pdf hal. 9). Panduan di layar: "DMF-T & Def-T diisi secara manual" (Rekam Medis.pdf hal. 9, gambar "Panduan Pengisian"; odonto, string yang sama). Kode punya field `decayed`, `missing`, `filling`, `score` (odonto).
- **Wajib?** Tidak. Kondisi tidak termasuk syarat "Selesai" (lihat Langkah 6).

### 4b. Tindakan

- **Layar**: sub-tab **Tindakan** → "+ Tambah Tindakan" → modal **Tindakan Medis** (Rekam Medis.pdf hal. 11).
- **Field**: Nama Pelayanan (dropdown dari master), Jumlah (wajib, min 1), Harga Satuan (terisi otomatis, **abu-abu, tidak bisa diubah**) → Simpan. Jadi sekitar **3 field, 4 klik** per tindakan (Rekam Medis.pdf hal. 11; norm: `name:"hargaSatuan"… disabled:!0,readOnly:!0`).
- **Pilih gigi**: "Pilih posisi gigi yang akan diberi tindakan medis (**opsional**)". Daftar gigi diambil dari Kondisi. Jika belum ada kondisi: "Untuk memilih kondisi gigi, tambahkan data pada halaman Kondisi terlebih dahulu." Tanpa gigi → disimpan sebagai "Semua Gigi" (norm).
- **Duplikat**: sebelum simpan ada cek `/rekam_medis/tindakan_umum/validasi`. Jika tindakan yang sama sudah ada di gigi yang sama, muncul: "Apakah Anda ingin menambahkan tindakan baru untuk posisi gigi yang sama?" dengan tombol "Tambah Tindakan Baru" / "Batal" (norm).
- **Wajib?** Ya. "Untuk data diagnosa dan tindakan bersifat wajib di isi" (Rekam Medis.pdf hal. 10).
- **Tabel tindakan** dilihat dokter: Kd. Pelayanan, Nama Pelayanan, Jml, Tarif, Diskon, Sub Total Biaya. Di bawahnya: Total Biaya Tindakan, Total Biaya Alkes, Total Biaya Obat, Total Diskon, Total Piutang, Total Biaya (Rekam Medis.pdf hal. 11; norm). **Dokter melihat harga.**
- **Pemakaian Alkes** (bahan habis pakai yang dibayar pasien): Jenis Barang, Kode Barang, Nama Barang, Jumlah, Harga Satuan (terkunci) (Rekam Medis.pdf hal. 12).
- Informed consent bisa dibuka dari tab ini (Rekam Medis.pdf hal. 11).

### 4c. Diagnosa dan ICD

- **Layar**: sub-tab **Diagnosa** → "+ Tambah Diagnosa" → modal: Jenis Diagnosa (Utama/Sekunder), Kode Diagnosa (kategori ICD-10, mis. K02), Rincian Diagnosa (subkode ICD-10), Keterangan (Rekam Medis.pdf hal. 10).
- **ICD-10 tidak wajib**. Boleh "Diagnosa tanpa ICD" dengan keterangan saja (Rekam Medis.pdf hal. 10). Tapi **baris diagnosa wajib ada** (Rekam Medis.pdf hal. 10).
- **Siapa**: tab "Diagnosa dokter" vs "Asuhan keperawatan" (norm). Pembatasan per peran: tidak ditemukan di dokumen.
- **ICD-9-CM untuk tindakan**: tidak ditemukan di dokumen (tidak ada di PDF; tidak ada string ICD-9 di JS).
- **Default ICD per tindakan**: tidak ditemukan di dokumen.
- Untuk BPJS ada field tambahan (TACC + alasan, prognosa, terapi) dan pencarian diagnosa PCare (`/bpjs/pcare/diagnosa?`) (norm).

## Langkah 5. Perbaikan odontogram

- Ada route **edit**: `/klinikme/rekammedis/gigi/odontogram/edit/[noreg]` dan `/klinikme/rekammedis/gigi/edit/[noreg]` (routes; edit).
- Penyimpanan odontogram kunjungan yang sama memakai `PUT` = **menimpa** data lama (odonto). Panel "Riwayat" dengan ikon hapus juga terlihat di Form Kondisi (Rekam Medis.pdf hal. 9).
- Ada label "Waktu Terakhir Disimpan" (odonto).
- Versi, alasan koreksi, batas 2x24 jam, atau jejak audit: **tidak ditemukan di dokumen**.
- Penguncian setelah "Selesai": tidak ditemukan di dokumen.

## Langkah 6. Selesai dan billing

### Tombol Selesai (penutupan kunjungan)

- Tombol **Selesai** ada di setiap sub-tab Diagnosa & Tindakan (Rekam Medis.pdf hal. 10–12).
- Syarat: dua daftar harus terisi. Jika belum, muncul "Anda belum mengisi data …" dan "Proses rekam medis tidak dapat diselesaikan sebelum anda melengkapi data di atas" (norm). Ini sesuai dengan "diagnosa dan tindakan bersifat wajib" (Rekam Medis.pdf hal. 10). Untuk BPJS juga butuh Pemeriksaan Umum (norm, cek `Id_PeriksaUmum` dan `"BPJS"`).
- Saat lolos: `POST /rekam_medis/status_penanganan/{noreg}` lalu pindah ke `/klinikme/rekammedis/success/{noreg}` (norm).
- Apa yang dikunci setelah itu: tidak ditemukan di dokumen.

### Billing (kasir)

- **Siapa**: kasir / front desk, menu **Billing** (`/klinikme/billing/daftarbilling`, `/billing/pasien/[nobill]`) (routes).
- **Tagihan Hari Ini**: daftar pasien belum bayar (tgl, no. registrasi, nama, grup pasien, dokter, status "Belum dibayar") → tombol **Bayar** (Billing.pdf hal. 2).
- **Form Tagihan**: rincian tindakan medis dan rincian obat (Tarif, Diskon, Dijamin, Sub Total), Metode Pembayaran, ringkasan biaya (Billing.pdf hal. 2).
- **Biaya Dijamin** (opsional): masukkan nominal yang ditanggung BPJS/asuransi (Billing.pdf hal. 2).
- **Biaya Dibebaskan** (opsional): potongan manual, **hanya untuk biaya tindakan** (Billing.pdf hal. 2).
- **Bayar**: modal No. Faktur, Terima dari, Total Tagihan, Tunai, Kembali (Billing.pdf hal. 2). Jadi sekitar **3–4 klik** untuk bayar tunai.
- Invoice dikirim via email atau dicetak (2 format) (Billing.pdf hal. 3). Ada pembatalan struk (Billing.pdf hal. 4; route `/billing/pembatalanstruk/[nostruk]`).
- Ada route `/billing/pasien/piutang/[nobill]` untuk piutang (routes).

### Dari tindakan ke harga

- **Master tarif**: Pengaturan → Pelayanan Klinik. Harga satuan = Jasa Dokter + Jasa Perawat + Jasa Sarana + Jasa KlinikMe (biaya aplikasi, otomatis) (Pengaturan.pdf hal. 2). Harga dikunci dari master, dokter tidak mengetik harga (Rekam Medis.pdf hal. 11).
- **Tindakan tanpa tarif**: harga satuan dikosongkan (`v("hargaSatuan","")`) dan field tetap terkunci (norm). Apakah simpan diblok: tidak ditemukan di dokumen. Panduan hanya bilang: jika nama pelayanan kosong, cek menu pengaturan (Rekam Medis.pdf hal. 11).
- **Diskon**: master **Diskon Pelayanan** (nama, masa berlaku, % atau nominal, daftar pelayanan/obat, status aktif) (Pengaturan.pdf hal. 3). Diskon tampil per baris (`DiskonFlat`) (norm). Potongan manual di kasir lewat "Biaya Dibebaskan" (Billing.pdf hal. 2).
- **Paket / multi-kunjungan**: master **Paket Pelayanan Klinik** (harga = jumlah harga isi paket) (Pengaturan.pdf hal. 3). Di rekam medis ada notifikasi "**Sisa Angsuran** Paket … Sebesar …" dan "Pasien dapat melakukan pembayaran ketika menggunakan paket" (norm, `dataPiutangPaket`). Jadi paket bisa dicicil per kunjungan.
- **Tahapan tindakan / kontrol gratis**: tidak ditemukan di dokumen.

### Rencana perawatan

- Rencana perawatan gigi (treatment plan) **tidak wajib** dan tidak ditemukan sebagai fitur di panduan gigi. Ada "Plan" di format SOAP/CPPT dan "Detail Rencana Tindak Lanjut" (norm), tetapi bukan syarat "Selesai".

## Hak akses (Pengaturan)

- Akun pegawai dibuat dengan centang "Buat Akun", lalu centang fitur satu per satu: Dashboard, Registrasi, Rujukan, Laporan, Rekam Medis Umum/Gigi/Kecantikan, Tagihan Pasien, Tagihan Apotek, pengaturan, farmasi (Pengaturan.pdf hal. 6).
- "Setiap hak akses yang dimiliki oleh user adalah tanggung jawab dari user admin" (Pengaturan.pdf hal. 6).
- Pembatasan khusus (mis. dokter tidak boleh lihat harga, kasir tidak boleh lihat catatan klinis): tidak ditemukan di dokumen.

---

## Ide yang bisa diadopsi Bittodent (maks. 8)

1. **Pasien lama = cari → 1 klik → 4 pilihan** (Langkah 1). Registrasi ulang hanya meminta grup pasien, layanan, ruang, dokter (Registrasi.pdf hal. 4). Bittodent: isi otomatis kursi/dokter dari jadwal, jadi front desk cukup konfirmasi.
2. **Antrean selalu terlihat di panel kanan** di semua modul, klik → langsung ke rekam medis (Registrasi.pdf hal. 4; Rekam Medis.pdf hal. 7). Cocok untuk dokter yang pindah pasien cepat.
3. **Harga terkunci dari master** di form tindakan (Rekam Medis.pdf hal. 11). Bittodent bisa lebih jauh: dokter tidak perlu melihat harga sama sekali, harga hanya muncul di kasir.
4. **Cek duplikat tindakan di gigi yang sama** dengan dialog "tambah lagi atau batal" (Langkah 4, norm `tindakan_umum/validasi`). Murah dan mencegah tagihan ganda.
5. **Tombol Selesai dengan syarat minimum yang jelas** dan pesan "belum bisa diselesaikan, lengkapi dulu …" (Langkah 6, norm). Bittodent: syarat = minimal 1 tindakan + tanda tangan dokter; ICD boleh menyusul (draf).
6. **Diagnosa tanpa kode tetap boleh** (teks bebas), kode ICD-10 sebagai pilihan (Rekam Medis.pdf hal. 10). Bittodent: saran ICD-10 otomatis dari tindakan, dokter tinggal setuju.
7. **Panduan pengisian 3 langkah di samping odontogram** ("pilih kondisi → klik gigi → benar") dan konfirmasi bagian gigi sebelum simpan (odonto). Berguna untuk mode koreksi odontogram (Langkah 5).
8. **Paket dengan sisa angsuran yang tampil ke dokter dan kasir** (norm "Sisa Angsuran"; Pengaturan.pdf hal. 3). Bittodent: untuk perawatan multi-kunjungan (mis. saluran akar), tampilkan "kunjungan ke-2 dari 3" dan sisa bayar, dan kontrol gratis sebagai tindakan bertarif 0.

## Di mana KlinikMe lebih buruk / lebih banyak langkah

- **Odontogram digambar manual dan terpisah dari tindakan.** Dokter harus menggambar kondisi dulu, baru bisa memilih gigi untuk tindakan (norm). Arah Bittodent (tindakan → odontogram terisi sendiri) menghemat satu layar penuh.
- **Odontogram per kunjungan ditimpa (`PUT`)**, tanpa versi atau alasan koreksi yang terlihat (odonto). Bittodent mewajibkan versi baru + audit.
- **Odontogram disimpan sebagai gambar PNG** dari canvas (odonto). Sulit dicari, dilaporkan, atau dikirim ke SATUSEHAT per gigi.
- **Skor DMF-T diisi manual** (Rekam Medis.pdf hal. 9), padahal bisa dihitung dari kondisi.
- **Diagnosa wajib untuk Selesai**, tetapi ICD tidak wajib. Ini menambah langkah tanpa menjamin kode yang bisa dilaporkan.
- **Keluhan tidak bisa diisi front desk saat registrasi.** Dokter atau perawat harus membuka tab Catatan Klinik terpisah (Registrasi.pdf hal. 2; Rekam Medis.pdf hal. 7).
- **Tidak ada ICD-9-CM untuk tindakan** yang terlihat di dokumen. Ini penting untuk SATUSEHAT/BPJS nanti.
- **Banyak tab dan form** (4 tab utama × 4 sub-tab, ditambah ±12 form asesmen/consent, routes). Untuk praktik mandiri ini berat. Mode sederhana Bittodent (D-007) lebih cocok.
