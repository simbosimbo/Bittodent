# Agen AI (draf 2)

*Agen AI = program yang bisa menjalankan tugas sendiri, tapi hanya dengan alat dan izin yang kita berikan.*

## Aturan umum (berlaku untuk semua agen)
1. **Draf dulu.** Semua keluaran klinis (catatan, diagnosis, kode, resep, odontogram) berstatus *draf* sampai dokter gigi berizin menyetujuinya. Draf tidak terkirim ke SATUSEHAT, BPJS, atau pasien.
2. **Hak akses minimum.** Setiap agen hanya bisa membaca/menulis data yang perlu untuk tugasnya, hanya di klinik (tenant) itu. *Tenant* = satu klinik pelanggan yang datanya terpisah total dari klinik lain.
3. **Tidak pernah**: menghapus rekam medis, mengubah catatan yang sudah disetujui, memberi nasihat medis langsung ke pasien, menjanjikan hasil pengobatan, mengakses data klinik lain, atau mengirim data ke layanan AI pihak ketiga tanpa kontrak dan persetujuan yang sah.
4. **Log lengkap.** Setiap aksi dicatat di jejak audit: agen apa, versi model/prompt, input yang dibaca (referensi, bukan salinan isi), keluaran, siapa yang menyetujui/menolak, kapan. *Jejak audit* = catatan permanen siapa melakukan apa dan kapan, tidak bisa diubah.
5. **Gagal aman.** Kalau ragu atau data tidak lengkap, agen berhenti dan meminta manusia, bukan menebak.
6. **Teks dari luar bukan perintah.** Pesan WhatsApp, email, atau dokumen pasien hanya dibaca sebagai data. Agen tidak menjalankan instruksi yang ada di dalamnya (mencegah *prompt injection* = upaya menyusupkan perintah lewat teks).

## Daftar agen

### 1. Agen Pendaftaran (Intake)
- **Tugas:** bantu pasien isi formulir pendaftaran & riwayat medis (link web/WhatsApp), cek kelengkapan, tandai duplikat.
- **Input:** isian pasien, foto KTP/kartu asuransi (jika pasien setuju).
- **Tidak boleh:** membuat nomor RM final tanpa cek petugas, menggabungkan dua pasien sendiri, menyimpan foto KTP lebih lama dari perlu.
- **Persetujuan manusia:** petugas front desk memverifikasi identitas (NIK) dan menyetujui data.
- **Log:** formulir masuk, perubahan field, siapa yang memverifikasi.

### 2. Agen Penjadwalan (pengingat WhatsApp)
- **Tugas:** tawarkan slot kosong, kirim pengingat dan konfirmasi via WhatsApp, isi slot batal dari daftar tunggu.
- **Input:** kalender dokter/kursi, preferensi pasien, persetujuan pasien untuk dihubungi.
- **Tidak boleh:** menyebut diagnosis/tindakan di pesan WhatsApp (cukup "janji temu di Klinik X jam Y"), menghubungi pasien yang belum setuju, overbooking.
- **Persetujuan manusia:** template pesan disetujui pemilik klinik sekali di awal; perubahan jadwal dokter oleh front desk.
- **Log:** pesan terkirim, status terkirim/dibaca, balasan, perubahan jadwal.
- **Catatan:** WhatsApp Business API punya aturan template sendiri — perlu dicek.

### 3. Agen Scribe Charting (suara → draf catatan)
- **Tugas:** ubah dikte dokter (suara menjadi teks) menjadi draf catatan SOAP dan draf isian odontogram yang berlabel jelas sebagai draf. Hanya merapikan apa yang diucapkan dokter, bukan menambah isi.
- **Input:** audio (hanya jika pasien sudah setuju direkam), odontogram sebelumnya, transkrip.
- **Tidak boleh:** menambah diagnosis, obat, atau kode ICD/KFA yang tidak diucapkan dokter; mengunci atau menandatangani catatan; mengirim audio/teks ke luar Indonesia atau lewat inferensi Geo/Global; berjalan saat offline; menyimpan audio setelah catatan ditandatangani (D-038: hapus audio; transkrip dan selisih draf vs versi akhir tetap di jejak audit).
- **Pemrosesan:** hanya di Indonesia. Calon teknis (14 Nov 2026): Bedrock Jakarta, model `mistral.voxtral-mini-3b-2507` (in-region). Amazon Transcribe **tidak** ada di Jakarta. Akurasi Bahasa Indonesia istilah gigi: perlu diuji.
- **Persetujuan manusia:** **dokter gigi pemberi layanan** membaca, mengedit, lalu menandatangani. Baru setelah itu catatan sah (Permenkes 24/2022 Pasal 16 ayat 2: nama, waktu, tanda tangan nakes). Draf tidak pernah jadi final sendiri.
- **Log:** izin rekam, wilayah/model yang dipakai, versi draf vs versi akhir (selisih edit), waktu tanda tangan, waktu audio dihapus.

### 4. Agen Koding & Klaim (ICD-10, ICD-9-CM, BPJS)
- **Tugas:** usulkan kode diagnosis **ICD-10** (daftar kode penyakit WHO) dan kode tindakan **ICD-9-CM** (daftar kode prosedur) dari catatan yang sudah disetujui; siapkan berkas klaim asuransi/BPJS.
- **Input:** catatan SOAP yang sudah disetujui, data kepesertaan.
- **Tidak boleh:** menambah kode yang tidak didukung catatan (*upcoding*), mengirim klaim tanpa persetujuan, mengubah catatan klinis agar klaim lolos.
- **Persetujuan manusia:** dokter mengonfirmasi kode; petugas/kasir mengirim klaim.
- **Log:** kode usulan, alasan (kutipan bagian catatan), kode final, status klaim.
- **Catatan:** versi kode yang dipakai harus sama dengan SATUSEHAT (ICD-9-CM versi 2010 menurut dokumentasi SATUSEHAT) dan BPJS — perlu dicek untuk BPJS.

### 5. Agen Recall
- **Tugas:** cari pasien yang jatuh tempo kontrol (misal 6 bulan) dan kirim ajakan via WhatsApp.
- **Input:** riwayat kunjungan, interval recall yang diatur dokter, persetujuan kontak.
- **Tidak boleh:** menentukan interval recall klinis sendiri, mengirim ke pasien yang menolak/meninggal/pindah.
- **Persetujuan manusia:** dokter mengatur aturan recall; pemilik menyetujui template.
- **Log:** daftar target, pesan, hasil (booking/menolak).

### 6. Agen Tindak Lanjut Tagihan
- **Tugas:** kirim pengingat tagihan yang belum dibayar, cocokkan pembayaran masuk, tandai klaim yang ditolak.
- **Input:** tagihan, pembayaran, status klaim.
- **Tidak boleh:** memberi diskon/menghapus utang, mengancam pasien, menyebut rincian tindakan di pesan, mengakses data kartu pembayaran.
- **Persetujuan manusia:** kasir/pemilik menyetujui penghapusan, diskon, dan pengembalian dana.
- **Log:** pengingat terkirim, pembayaran tercocokkan, eskalasi.

## Siapa menyetujui apa

| Keluaran agen | Penyetuju |
|---|---|
| Data pendaftaran | Front desk |
| Jadwal & template pesan | Front desk / pemilik |
| Catatan klinis, odontogram, resep | **Dokter gigi berizin** |
| Kode ICD | Dokter gigi |
| Pengiriman klaim, diskon, refund | Kasir / pemilik |

## Risiko utama agen
- **Halusinasi** (AI menulis hal yang tidak terjadi) → dokter wajib baca draf; tampilkan sumber tiap kalimat.
- **Kebocoran data ke penyedia model AI** → kontrak pemrosesan data, tanpa pelatihan model dengan data klinik, semua pemrosesan AI di Indonesia (D-009, D-037; lihat architecture.md bagian 9 dan docs/research/review-peran.md).
- **Keputusan otomatis berisiko tinggi** → UU PDP Pasal 34 mewajibkan penilaian dampak (DPIA) untuk keputusan otomatis berdampak signifikan dan data spesifik (data kesehatan).
