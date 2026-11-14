# Zendenta: pola laci samping dan alur booking (inspirasi saja)

*Dicek 14 Nov 2026. Karya Fikri Studio untuk klien lain. Kita hanya mengambil idenya; **tidak menyalin** desain, aset, ikon, tata letak piksel, atau teks mereka (D-006).*

## Sumber yang dibuka

| Sumber | Tautan | Status akses 14 Nov 2026 |
|---|---|---|
| Studi kasus resmi Fikri Studio | [fikristudio.com/project/zendenta](https://fikristudio.com/project/zendenta) | Halaman berhasil dibaca |
| Ringkasan di Layers | [Zendenta Dashboard (Layers)](https://layers.to/layers/cm2ock9oz000kmd0c8wnthsiq) | Halaman berhasil dibaca; menaut ke studi kasus di atas, menyebut EHR, booking, jadwal, pasien, dan pembayaran |
| Dribbble (judul shot publik) | antar lain [Dashboard](https://dribbble.com/shots/24571656-Zendenta-Dashboard-for-SaaS-Dental-Clinic-Management), [Patient Mobile App](https://dribbble.com/shots/14960566-Zendenta-Patient-Mobile-App), dan kumpulan judul di [dribbble.com/tags/saas-dental](https://dribbble.com/tags/saas-dental) | Judul shot terlihat di hasil pencarian; **isi gambar tidak berhasil dibuka** (akses ditolak). Jadi kerapatan visual dan apakah panel persis berupa “laci yang menyapu dari sisi” **tidak kami klaim** dari cuplikan |
| Behance V1 / V2 | [V1 (2020)](https://www.behance.net/gallery/90714005/Zendenta-Dental-clinic-management-system) · [V2 (2024)](https://www.behance.net/gallery/197426423/Zendenta-V2-Dental-Clinic-Management-System-SaaS) | Judul galeri publik; **isi gambar tidak berhasil dibuka** (akses ditolak) |

Klaim di bawah ini hanya berasal dari teks halaman resmi Fikri Studio, ringkasan Layers, dan judul shot yang memang tertulis di halaman publik. Yang tidak terlihat ditandai “tidak diverifikasi dari gambar”.

## Apa yang tertulis di halaman resmi

Dari [studi kasus Zendenta](https://fikristudio.com/project/zendenta):

- Penjadwalan janji temu yang cepat dan mudah dipakai staf maupun pasien.
- **Daftar tunggu (waitlist):** staf bisa memasukkan pasien ke daftar tunggu “dengan sekali klik”, agar antrean lebih rapi.
- Pemeriksaan dicatat dalam **4 langkah**: informasi penting, rencana perawatan, hasil periksa mulut, dan persetujuan.
- Staf mengelola janji, data pribadi, dan catatan penting pasien **di satu tempat**.
- Ada alur menambah rekam dan **menyelesaikan perawatan** (*finish treatment*).
- Modul penjualan: bayar tagihan, lacak transaksi, pindah uang antar **“kantong”** (misal kas bebas dan dana perawatan).
- Daftar pasien (kontak, kunjungan terakhir, perawatan terkini), jadwal staf, dan inventaris.
- Aplikasi pasien (dari teks di halaman yang sama): di kiri daftar janji yang akan datang dan yang sudah selesai (jam, jenis perawatan, status bayar); **di kanan detail satu janji** (lokasi klinik, rincian perawatan, perkiraan lama, dokter).

Judul shot publik yang menyinggung booking dan panel detail (tanpa kami melihat isinya): *Reservation Detail*, *Patient Reservation Details*, *Calendar Overview*, *Calendar Reservations*, *Add Patient to Waitlist*, *Add Medical Checkup*, *Select a Payment Method*, *Explore Detailed Patient*, *Dental Treatment Booking Flow in Patient Mobile App*.

## Pola yang kami pakai sebagai inspirasi

**Laci / panel samping** (*drawer* = panel yang terbuka di sisi layar, sementara kalender atau daftar tetap terlihat di belakangnya):

- Kalender atau daftar janji tetap jadi “panggung utama”. Detail janji, pasien, atau pembayaran tidak memaksa pindah ke halaman baru.
- Formulir singkat (buat janji, masukkan daftar tunggu, terima pembayaran, lihat ringkas pasien) cukup di panel sisi. Pekerjaan panjang (odontogram, SOAP, profil lengkap) tetap halaman penuh, supaya ada ruang dan lebih aman di tablet.
- Konteks pasien (nama, no. RM, alergi, peringatan) tetap terlihat saat panel terbuka — ini tambahan wajib Bitto, bukan klaim bahwa Zendenta sudah menampilkannya (kami tidak melihat cuplikannya).

**Alur booking** yang diadaptasi:

- Staf membuat janji cepat dari kalender, dengan dokter dan kursi, tanpa bentrok (aturan Bitto: JDW-1).
- Pasien datang langsung (*walk-in* = tanpa janji sebelumnya) bisa masuk antrean/daftar tunggu, lalu mendapat kursi.
- Daftar tunggu diisi dengan aksi singkat, bukan alur panjang.
- Aplikasi/tautan pasien boleh memesan dan melihat detail janji (jam, cabang, durasi, dokter) **tanpa menampilkan diagnosis** di pesan atau layar publik.

## Yang kita ambil

- Kalender sebagai pusat kerja front desk, dengan aksi booking yang singkat.
- Panel sisi untuk detail janji, ringkas pasien, daftar tunggu, dan pembayaran, agar staf tidak “hilang” dari papan jadwal.
- Daftar tunggu yang mudah diisi.
- Pemeriksaan berlangkah (kita kembangkan: anamnesis → tindakan → catatan ditandatangani → tagihan → janji berikutnya).
- Pemisahan “kantong” uang di kasir (sudah ada di product.md / KSR-4).

## Yang kita ubah (jangan ikut Zendenta apa adanya)

- **Rekam medis sah hanya setelah dokter gigi menandatangani.** Draf, termasuk bantuan AI, belum menjadi rekam medis (D-001; UU 17/2023 Pasal 296 ayat 4; Permenkes 24/2022 Pasal 16 ayat 2).
- Alergi, obat, dan peringatan medis selalu terlihat selama panel terbuka.
- NIK dan nomor HP tersamarkan di layar staf; buka lengkap hanya dengan alasan dan jejak audit.
- Dokter tidak mengetik harga sendiri; harga diambil dari daftar tarif + tingkat kesulitan, lalu disalin ke tagihan.
- Resep memakai kode KFA dan aturan e-resep Indonesia; AI tidak meresepkan obat.
- Odontogram, SATUSEHAT, WhatsApp, dan pemisahan data antar-klinik adalah milik Bitto, bukan bagian yang kami klaim ada di Zendenta.
- Logo, ikon, warna merek, dan teks antarmuka dibuat sendiri.

## Implikasi ke layar Bitto

Rincian layar mana yang memakai laci vs halaman penuh: [flows/kunjungan.md](../flows/kunjungan.md). Gaya cangkang tetap **gaya A** (pilihan Jerome), dengan penanda pasien aktif di bilah atas.
