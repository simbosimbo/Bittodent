# Referensi Mobbin: mode Kasir, laporan HP, unduh, profil klinik

Sumber utama: sesi Claude Code (`/home/box/.local/bin/claude`, RTK) dengan Mobbin MCP
(`claude mcp list` menampilkan `claude.ai Mobbin` sebagai Connected). Claude menulis
12 referensi di bawah. Square, Toast, Shopify POS, dan Loyverse tidak muncul di
Mobbin, jadi kelompok POS memakai pola setara (Careem, Splitwise, IKEA, Shop).

Cadangan: connector `user-Mobbin` (search_screens / search_flows) dipakai saat sesi
Claude belum selesai. Beberapa layar itu (Shopify Analytics, Fresha invoice, Airbnb
metode bayar, LinkedIn unduh) overlap pola dengan daftar Claude, dan Shopify
Analytics muncul di kedua sumber (URL yang sama).

Data di papan adalah DATA SINTETIS.

## Yang dipakai di papan

- Antrean dan rincian tagihan: IKEA store checkout (daftar item, diskon sebelum bayar).
- Metode bayar radio kartu: Careem (satu konfirmasi lebar di bawah).
- Pecah pembayaran: Splitwise (baris nominal per sumber, sisa terlihat).
- Struk dan kirim: Shop (hierarki total) dan inDrive (pratinjau plus Unduh / Bagikan / Email, Email diganti WhatsApp).
- Laporan HP: Shopify Analytics (KPI plus grafik) dan Revolut Business (chip periode).
- List kartu, bukan tabel: Starling (grup dan kartu transaksi).
- Sheet unduh: Satispay (periode, format PDF atau Excel) dan bunq (arsip).
- Profil dan logo: Jobber (form perusahaan, lokasi terpisah) dan Quo (ketuk untuk ganti logo, plus potong 1:1).
- Tutup shift: tidak ada referensi Mobbin yang cocok; pola disusun dari rekap metode plus selisih kas.

## 1. POS / Kasir

### 1. Careem: Pilih metode pembayaran
- Jenis: POS
- URL: https://mobbin.com/screens/47f6e4cd-31b4-457e-a4ac-8afa07d3e498?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: daftar metode (Saldo, Kartu, Apple Pay, Tunai) sebagai kartu terpisah dengan radio di kanan, satu tombol "Confirm" lebar menempel di bawah. Cocok untuk Tunai / Debit / QRIS / Transfer.
- Jangan tiru: toggle wallet di atas daftar (tidak relevan untuk klinik), tombol "Set Nickname" pada kartu.

### 2. Splitwise: Split by exact amounts
- Jenis: POS (split tender)
- URL: https://mobbin.com/screens/b6edb734-1356-4e15-80e7-8d270d471d81?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: baris per sumber bayar dengan input nominal rata kanan, plus footer tetap "Rp X dari Rp Y, sisa Rp Z" yang selalu terlihat sampai lunas. Segmented control mode (= / nominal / %) untuk bagi rata atau manual.
- Jangan tiru: ilustrasi karakter dan konsep "orang" sebagai pembayar; di kasir baris harus berupa metode bayar (Tunai, Debit, QRIS, asuransi).

### 3. IKEA: Store checkout (alur)
- Jenis: POS (antrean tagihan, konfirmasi)
- URL: https://mobbin.com/flows/3db9e255-0b62-4bc6-84cc-ff3562642a7e?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: daftar item tagihan dengan stepper jumlah dan harga rata kanan, baris "Tambah kode diskon" sebelum tombol bayar utama; bottom sheet konfirmasi "sudah lengkap?" dengan tujuan struk (email/WA) sebelum bayar.
- Jangan tiru: kode SKU panjang di bawah nama item; tindakan klinik cukup nama tindakan, gigi/nomor, dan dokter.

### 4. Shop: Struk pesanan (alur)
- Jenis: POS (struk)
- URL: https://mobbin.com/flows/c61e4d3b-629f-48b5-a322-5472f46e9b1b?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: hierarki struk: nomor dan tanggal di atas, item, lalu Subtotal / Diskon / Pajak, "Total" tebal dan besar, lalu blok metode bayar; tombol bagikan bulat di kanan atas.
- Jangan tiru: carousel produk rekomendasi dan banner cashback setelah transaksi.

## 2. Laporan / Analytics

### 5. Shopify: Analytics
- Jenis: Laporan
- URL: https://mobbin.com/screens/61c1f44d-31bc-4c87-b075-41c872410397?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: tumpukan kartu KPI satu kolom (label kecil, angka besar, sparkline kecil di kanan), lalu satu grafik penuh di bawah. Mudah dipindai dengan jempol.
- Jangan tiru: grafik dengan sumbu tipis dan garis putus-putus yang sulit dibaca; dropdown judul "Analytics" sebagai pengganti filter periode yang jelas.

### 6. Revolut Business: Merchant revenue
- Jenis: Laporan
- URL: https://mobbin.com/screens/4cbc7fb1-eaaa-4067-9e4b-d42b9cb4a7bf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: chip filter di bawah judul (rentang tanggal dengan ikon kalender); tiap kartu berisi angka total, subjudul periode, lalu grafik sederhana. Kartu "Metode pembayaran" terpisah dengan legenda per metode.
- Jangan tiru: tema gelap penuh dan grafik area bergradasi untuk data harian yang sedikit.

### 7. Starling: Transaksi dikelompokkan per tanggal
- Jenis: Laporan (daftar transaksi)
- URL: https://mobbin.com/screens/5f00713b-a76e-45eb-8ca6-694eb41fd744?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: header grup per hari dengan total harian di kanan, isi berupa kartu (ikon, nama, jam dan kategori, nominal tebal). Pengganti tabel lebar untuk daftar tagihan pasien. Link "Cari & filter" di kanan atas.
- Jangan tiru: warna hijau untuk nominal masuk tanpa label; di klinik beri status teks (Lunas, Sebagian, Refund).

## 3. Unduh / Ekspor

### 8. Satispay: Export Report
- Jenis: Unduh
- URL: https://mobbin.com/screens/77ecd3f1-030f-49ce-ba2a-0320a8c5132f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: dua bagian saja, "Pilih periode" lalu "Pilih format", format sebagai radio dengan deskripsi singkat ("PDF: untuk dibaca dan dibagikan", "Excel: untuk diolah"). Satu tombol Export di bawah.
- Jangan tiru: pemilih periode hanya tahunan; klinik butuh Hari ini / Minggu / Bulan / rentang khusus.

### 9. bunq: Export Statement
- Jenis: Unduh
- URL: https://mobbin.com/screens/c60e275c-6aef-4848-8e79-ecb79431750e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: daftar "Laporan sebelumnya" di bawah tombol ekspor, tiap baris berisi badge format (PDF), rentang tanggal, dan ikon unduh ulang.
- Jangan tiru: teks penjelasan teknis tentang apa itu PDF.

### 10. inDrive: Pratinjau dokumen PDF
- Jenis: Unduh (pratinjau)
- URL: https://mobbin.com/screens/e7ce7ac5-22ca-4d50-9bcf-8aaddf7da919?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: pratinjau halaman penuh dengan logo bisnis di kop, lalu baris aksi bawah tiga ikon berlabel: Unduh, Bagikan, Email (ganti dengan WhatsApp).
- Jangan tiru: teks dokumen yang terlalu kecil tanpa zoom; sediakan pinch zoom.

## 4. Profil Bisnis

### 11. Jobber: Company details
- Jenis: Profil
- URL: https://mobbin.com/screens/305f8ea0-9f75-44f0-9074-541c0f70836a?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: field berlabel mengambang (Nama klinik, Email, Telepon, Website), grup terpisah "Lokasi" untuk alamat, tombol Simpan tetap di bawah.
- Jangan tiru: alamat dipecah jadi banyak field (Address line 1/2, City); untuk Indonesia cukup satu textarea alamat plus kota.

### 12. Quo: General (logo dan nama workspace)
- Jenis: Profil (logo)
- URL: https://mobbin.com/screens/79de728e-3c61-4885-b253-19b6a239e996?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- Tiru: logo besar di tengah atas dengan teks "Ketuk untuk ganti logo", di bawahnya baris pengaturan dengan nilai di kanan dan chevron.
- Jangan tiru: tidak ada petunjuk format/ukuran logo; tambahkan "PNG/JPG, latar transparan disarankan" seperti di lembar unggah Revolut Business.

## Daftar URL

- https://mobbin.com/screens/47f6e4cd-31b4-457e-a4ac-8afa07d3e498?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/b6edb734-1356-4e15-80e7-8d270d471d81?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/flows/3db9e255-0b62-4bc6-84cc-ff3562642a7e?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/flows/c61e4d3b-629f-48b5-a322-5472f46e9b1b?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/61c1f44d-31bc-4c87-b075-41c872410397?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/4cbc7fb1-eaaa-4067-9e4b-d42b9cb4a7bf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/5f00713b-a76e-45eb-8ca6-694eb41fd744?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/77ecd3f1-030f-49ce-ba2a-0320a8c5132f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/c60e275c-6aef-4848-8e79-ecb79431750e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/e7ce7ac5-22ca-4d50-9bcf-8aaddf7da919?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/305f8ea0-9f75-44f0-9074-541c0f70836a?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
- https://mobbin.com/screens/79de728e-3c61-4885-b253-19b6a239e996?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp
