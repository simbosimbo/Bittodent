# Tinjauan per peran: kasir, dokter, pemilik

*14 Nov 2026, waktu Jakarta. Membandingkan spesifikasi, prototipe desain, dan aplikasi. Aplikasi hanya dibaca, tidak diubah. Semua contoh data palsu.*

Sumber spesifikasi: [user-stories.md](../user-stories.md), [flows/kunjungan.md](../flows/kunjungan.md), [decisions.md](../decisions.md), [agents.md](../agents.md). Prototipe: `/workspace/ehr-dental/design/prototype` dan `/workspace/ehr-dental/design/screenshots`. Aplikasi: `/workspace/ehr-dental/app` (dibaca 14 Nov 2026).

Urutan prioritas: keamanan & privasi → keselamatan klinis & keutuhan data → regulasi → fitur.

## Aturan akses yang dipakai dalam tinjauan ini

| Peran | Boleh | Tidak boleh |
|---|---|---|
| Kasir / front desk | Pendaftaran, jadwal, antrean, tagihan, pembayaran, kuitansi tanpa diagnosis; melihat peringatan alergi/premedikasi | Catatan klinis lengkap, diagnosis, SOAP, isi resep rinci |
| Dokter gigi | Rekam medis, odontogram, SOAP, dikte→draf, tanda tangan, resep cetak, rencana kunjungan; laporan bagi hasil miliknya sendiri, hanya baca (D-039) | Mengubah tarif, mengatur bagi hasil klinik, melihat aturan atau angka dokter lain |
| Pemilik | Pengaturan tarif dan bagi hasil, pengguna, laporan keuangan, jejak audit, template WhatsApp; membuka catatan klinis hanya baca (D-040), meski bukan dokter | Mengubah atau menandatangani catatan dokter lain |

**Yang sudah diputuskan (14 Nov 2026) dan sisa celah aplikasi:**

- ~~Q-20~~ → D-039: dokter boleh melihat laporan bagi hasil miliknya sendiri, hanya baca, tanpa aturan atau angka dokter lain. Ini mengubah sebagian D-034 (laporan sebelumnya hanya pemilik).
- ~~Q-21~~ → D-040: pemilik, meski bukan dokter, boleh membuka catatan klinis, hanya baca, tanpa `note.sign` dan tanpa ubahan. Setiap buka tercatat (siapa, kapan, pasien mana), tampil di layar audit pemilik, dan dijelaskan di pemberitahuan privasi. Izin `note.read` pemilik di aplikasi **dipertahankan**; yang masih kurang di aplikasi adalah jejak setiap baca dan layar audit. Risiko data spesifik: lihat compliance.md (UU PDP Pasal 4).
- Tidak ada peran `kasir` di matriks izin aplikasi. Pekerjaan kasir saat ini digabung ke `front_desk`. Ini belum menjadi keputusan terpisah.

## 1. Kasir

### Tugas di alur 9 langkah
Terutama langkah 8 (menagih), dan di banyak klinik juga membantu langkah 1–2, 4–5, dan 9 (cek-in, booking, antrean, janji berikutnya). Tidak mengisi atau membaca SOAP.

Layar yang dibutuhkan: laci pembayaran; tagihan kunjungan (item otomatis, sisa, bagian asuransi); kuitansi tanpa diagnosis; penyesuaian/diskon dengan alasan; tutup kas harian; papan antrean tanpa isi klinis.

### Apa yang sudah ada

| Kebutuhan | Spesifikasi | Prototipe | Aplikasi |
|---|---|---|---|
| Tagihan otomatis dari tindakan selesai | Ada (KSR-1, D-035, alur langkah 7–8) | Ada di layar Tagihan (`a-tagihan-desktop.png` / tablet) | Ada sebagian: baris tagihan dibuat listener saat tindakan tercatat; API baca tagihan + penyesuaian. **Belum ada layar** |
| Pembayaran tunai/transfer/kartu/QRIS, bayar sebagian | Ada (KSR-2, alur langkah 8) | Ada (tunai dll. di Tagihan; offline hanya tunai: `a-tagihan-offline-*.png`) | **Tidak ada** API atau layar pembayaran; README Billing: “Belum: pembayaran, tagihan final” |
| Bagi bagian asuransi, kuitansi tanpa diagnosis | Ada (KSR-3) | Sebagian: teks “Tanpa diagnosis”; pemisahan asuransi belum lengkap sebagai alur kasir | Tidak ada kuitansi, tidak ada pemisahan klaim |
| Tutup kas harian | Ada (KSR-6) | Tidak ada | Tidak ada |
| Tidak melihat catatan/diagnosis | Ada (RBA-1, alur kunjungan) | Tidak ditegakkan (prototipe tanpa login peran) | Front desk **tidak** punya `note.read`. Alergi + premedikasi tetap lewat `/alerts` (deviasi C3 no. 30). Ini sesuai aturan minimum |

### Yang kurang (utama)
1. Tidak ada pembayaran (tunai/transfer/kartu/QRIS) di aplikasi.
2. Tidak ada layar kasir/tagihan di aplikasi (hanya API baca + diskon).
3. Tidak ada cetak kuitansi tanpa diagnosis.
4. Tidak ada tutup kas harian.
5. Tidak ada peran kasir terpisah; papan antrean (modul Queue) masih kerangka kosong.

## 2. Dokter gigi

### Tugas di alur 9 langkah
Langkah 3 (meninjau anamnesis dan peringatan), 6 (tindakan, odontogram, SOAP, dikte→draf, tanda tangan), 7 (hasil + tingkat kesulitan; harga diisi sistem), resep cetak, dan catatan rencana kunjungan untuk langkah 9.

Layar yang dibutuhkan: Charting (odontogram + SOAP + tombol dikte), peringatan alergi selalu terlihat, tanda tangan, resep tercetak, rencana perawatan/persetujuan, janji terencana.

### Apa yang sudah ada

| Kebutuhan | Spesifikasi | Prototipe | Aplikasi |
|---|---|---|---|
| Odontogram + SOAP + tanda tangan | Ada (ODO, SOAP-1, D-017, D-001) | Ada (`a-charting-*.png`, `a-soap-draf-*.png`, `a-soap-terkunci-*.png`); label “dari dikte”, bukan diagnosis AI | Ada: bagan, temuan, SOAP, tanda tangan wajib TOTP, koreksi. **Tidak ada dikte suara** |
| Dikte suara → draf | Ada (SOAP-2, SOAP-3, SOAP-5; diperkuat SOAP-7 dan D-037) | Tombol “Susun draf dari dikte” (data palsu, bukan rekam mikrofon sungguhan) | Tidak ada |
| Tingkat kesulitan, tanpa ketik harga | Ada (KSL, D-035) | Tindakan bisa masuk rencana/tagihan; templat kesulitan tidak terlihat sebagai pengaturan | Kode/varian kesulitan ada di temuan (C3); dokter tidak melihat harga. Tidak ada layar pilih templat |
| Resep tercetak + KFA | Ada (RSP, D-036) | Tidak ada layar resep | Modul Prescriptions **belum ada fitur** (hanya kerangka) |
| Rencana perawatan & persetujuan | Ada (RPC, D-012) | Ada (`a-rencana-*.png`, `a-presentasi-*.png`) | Persetujuan minimal (tanpa 7 butir, tanpa coretan); rencana perawatan utuh belum ada. Janji terencana ada di API |
| Laporan bagi hasil milik sendiri | Ada (BGH-4, D-039) | Tidak ada | Modul Compensation belum ada fitur |

### Yang kurang (utama)
1. Dikte suara sungguhan (mikrofon → transkrip di Indonesia → draf berlabel) belum ada di aplikasi; prototipe hanya tombol palsu.
2. Tidak ada tulis/kunci/cetak resep (D-036).
3. Rencana perawatan dan persetujuan tertulis belum lengkap di aplikasi.
4. Tidak ada layar bagi hasil milik sendiri di aplikasi (aturan sudah D-039).
5. Dikte tidak tersedia offline sudah tertulis di spesifikasi, tetapi belum ada perilaku di aplikasi.

## 3. Pemilik klinik

### Tugas
Tidak merawat pasien, kecuali dia juga dokter (mode sederhana, D-007). Mengatur tarif dan tingkat kesulitan, bagi hasil, pengguna dan hak akses, template WhatsApp, melihat laporan keuangan dan jejak audit, status SATUSEHAT, dan (nanti) tutup/rekap kas.

### Apa yang sudah ada

| Kebutuhan | Spesifikasi | Prototipe | Aplikasi |
|---|---|---|---|
| Atur bagi hasil + laporan bulanan | Ada (BGH, D-034) | Tidak ada | Kerangka kosong |
| Templat tarif / tingkat kesulitan | Ada (KSL, D-035) | Tidak ada di Kelola | Tidak ada API/layar kelola tarif (harga masih seed) |
| Pengguna, 2FA, cabang | Ada (RBA) | Cuplikan Kelola: pengguna contoh, kursi, perangkat (`desktop-16-kelola.png`) | Login + 2FA + ganti cabang ada; tidak ada layar kelola pengguna |
| Laporan keuangan | Ada (laporan dasar MVP) | “Pendapatan per metode (hari ini)” di Kelola (data palsu) | Tidak ada modul Reporting |
| Jejak audit (tampilan) | Ada (RBA-2) | Tidak ada | Peristiwa audit ditulis; modul Audit belum punya layar |
| Buka catatan klinis, hanya baca, setiap buka tercatat | Ada (RBA-10, D-040) | Tidak ditegakkan | Pemilik **punya** `note.read` (sesuai D-040). Tidak punya `note.sign` (sesuai). Jejak setiap baca dan layar audit **belum ada** |

### Yang kurang (utama)
1. Tidak ada pengaturan dan laporan bagi hasil.
2. Tidak ada pengaturan tarif dan templat tingkat kesulitan.
3. Tidak ada layar laporan keuangan, tutup kas, atau status SATUSEHAT.
4. Tidak ada layar jejak audit dan kelola pengguna.
5. Jejak setiap buka catatan, layar audit, dan teks pemberitahuan privasi belum ada di aplikasi (izin `note.read` pemilik dipertahankan sesuai D-040).

## 4. Dikte suara (suara → teks → draf)

**Keputusan diterima (D-037, 14 Nov 2026):** dokter merekam diktenya. Sistem mengubah suara menjadi teks, lalu menyusun draf SOAP/odontogram yang **jelas berlabel draf**. Catatan tidak pernah jadi rekam medis sebelum dokter meninjau dan menandatangani. AI hanya menuliskan ulang dan merapikan apa yang diucapkan; **tidak menambah diagnosis, obat, atau kode sendiri**. Pemrosesan hanya di Indonesia. Tidak tersedia saat offline. Pasien harus sudah setuju direkam.

**Retensi audio (D-038, jawaban Q-4):** hapus berkas audio setelah catatan ditandatangani; simpan transkrip dan selisih draf versus versi akhir di jejak audit. Audio tidak disimpan sebagai bukti secara bawaan.

### Temuan AWS (dibaca 14 Nov 2026, waktu Jakarta)

- **Amazon Transcribe tidak tersedia di Jakarta** (`ap-southeast-3`). Tidak ada di daftar wilayah maupun daftar endpoint resmi. Wilayah Asia terdekat yang tercantum: Singapura (`ap-southeast-1`). Sumber: [What is Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) · [Endpoint Transcribe](https://docs.aws.amazon.com/general/latest/gr/transcribe.html).
- **Ada opsi suara→teks in-region di Bedrock Jakarta:** model `mistral.voxtral-mini-3b-2507` (Voxtral Mini 3B 2507), kolom In-Region bertanda didukung untuk `ap-southeast-3` (Jakarta); Geo dan Global **tidak didukung**. Sumber: [kartu model Voxtral Mini 3B 2507](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-mistral-ai-voxtral-mini-3b-2507.html).
- Akurasi Bahasa Indonesia dan istilah gigi pada model itu **belum terverifikasi** (tidak diuji di sini). Umur model di kartu: akhir layanan tercantum 30 Maret 2027. Tetap berlaku D-009: tanpa inferensi Geo/Global.

## 5. Jawaban Jerome (14 Nov 2026, waktu Jakarta)

- ~~**Q-4**~~ Ditutup, D-038: hapus audio setelah catatan ditandatangani; transkrip dan selisih draf versus versi akhir tetap di jejak audit.
- ~~**Q-20**~~ Ditutup, D-039: dokter boleh melihat laporan bagi hasil miliknya sendiri, hanya baca, tanpa aturan atau angka dokter lain.
- ~~**Q-21**~~ Ditutup, D-040: pemilik, meski bukan dokter, boleh membuka catatan klinis, hanya baca, tanpa tanda tangan atau ubahan; setiap buka tercatat (siapa, kapan, pasien mana), tampil di layar audit pemilik, dan dijelaskan di pemberitahuan privasi. Izin `note.read` pemilik di aplikasi dipertahankan.
