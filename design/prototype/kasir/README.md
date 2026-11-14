# Prototipe Kasir — Bittodent v2 (statis)

**DATA SINTETIS — prototipe desain, bukan aplikasi produksi.** Semua nama, nomor tagihan, dan angka dikarang. Nomor WA `0800-000-0000` dan email `budi.santoso@example.com` adalah contoh.

HTML + CSS + JavaScript biasa. Tanpa build, tanpa npm. Pola POS diambil dari [RESEARCH-POS.md](RESEARCH-POS.md).

## Cara membuka
```bash
cd design/prototype/kasir
python3 -m http.server 8000 --bind 127.0.0.1
# buka http://127.0.0.1:8000/
```
Bisa juga membuka `index.html` langsung. Font Plus Jakarta Sans dimuat dari Google Fonts (tanpa internet → fallback font sistem).

## Pengalih (bilah kuning di atas)
- **Peran**: Kasir/FO → Antrean · Dokter → Pendapatan Saya · Pemilik → Keuangan. Daftar **Layar**, sorotan sidebar, dan chip pengguna ikut berubah.
- Tautan langsung: `index.html#bayar` atau `index.html?layar=4` (nomor urut di daftar).
- Setiap layar punya `id="screen-…"` untuk Playwright (mis. `#screen-bayar`, `#screen-tutup-shift`).

| # | Layar | Hash | Peran |
|---|---|---|---|
| 1 | Antrean Kasir (padat) | `#antrean` | Kasir |
| 2 | Buka Shift — hitung kas awal per pecahan | `#buka-shift` | Kasir |
| 3 | Detail Tagihan (tinjau, diskon, deposit) | `#tagihan` | Kasir |
| 4 | Bayar — mode charge (ubin metode + keypad) | `#bayar` | Kasir |
| 5 | Lunas — layar sukses + aksi struk | `#lunas` | Kasir |
| 6 | Struk 58/80 mm/A5 + SALINAN + Void/Refund | `#struk` | Kasir |
| 7 | Void / Refund (modal di atas struk) | `#refund` | Kasir |
| 8 | Tutup Shift — hitung laci + ringkasan | `#tutup-shift` | Kasir |
| 9 | Laporan Kasir | `#laporan` | Kasir |
| 10 | Persetujuan Diskon (modal PIN di atas tagihan) | `#diskon` | Dokter |
| 11 | Pendapatan Saya (drg. Nadia Putri) | `#pendapatan` | Dokter |
| 12 | Laporan Kasir — **hanya lihat** | `#laporan-pemilik` | Pemilik |
| 13 | Dashboard Keuangan | `#keuangan` | Pemilik |
| 14 | Audit void/refund & selisih kas | `#audit` | Pemilik |
| 15 | Tarif & Kebijakan | `#tarif` | Pemilik |

## Alur utama
Antrean → **Bayar** (Budi) → Tagihan → **Bayar Rp 600.000** → mode charge → **Terima** → Lunas → Cetak / WhatsApp / Email / Lihat struk → (opsional) Void/Refund → Tutup Shift.

## Pola POS v2 (lihat RESEARCH-POS.md)
- **Antrean dipadatkan**: di 1440×900 tanpa gulir terlihat judul, KPI, daftar menunggu (Budi, Ratna, Alya), kartu Shift dengan **Tutup Shift**, dan kartu **Sisa tagihan**.
- **Tagihan** hanya untuk meninjau: item, catatan temuan, diskon, deposit, total besar, dan satu CTA besar "Bayar Rp 600.000". Tidak ada lagi panel bayar sempit.
- **Mode charge** (`#bayar`): jumlah sangat besar, ubin metode tinggi 68px (Tunai, QRIS, EDC, Transfer, Split), keypad 1–9/000/0/hapus (tombol 64px; 56px di tablet). Chip **Uang pas** mengisi tepat sisa; chip pecahan **menambah** (+50.000 … +1.000.000), seperti menumpuk lembaran. Kembalian dihitung langsung. "Terima Rp …" aktif bila uang diterima ≥ sisa. Keyboard fisik juga bisa (angka, Backspace, Enter).
  - QRIS/EDC/Transfer: tanpa keypad, tombol "Pembayaran diterima".
  - Split: keypad mengisi bagian tunai, sisanya otomatis ke QRIS/EDC/Transfer.
- **Lunas**: centang besar, jumlah, metode; aksi besar Cetak struk / WhatsApp / Email; lalu Lihat struk, Buat janji kontrol, Selesai, Void/Refund. WA dan email hanya pratinjau/toast.
- **Struk & Lunas** mengikuti pembayaran yang benar-benar dipilih di mode charge (metode, uang diterima, kembalian, split).

## Aturan yang tertanam
- Tagihan hanya dari **tindakan bertanda tangan hari ini**; FDI gigi + permukaan di setiap item. **Temuan odontogram tidak ditagihkan** (26-O karies, 46 hilang tampil sebagai catatan).
- Semua pasien **Umum**; tidak ada asuransi/BPJS.
- **Diskon bawaan 0% ("Tanpa")**. Kasir maks. 10% atau Rp 100.000 (mana yang lebih kecil, untuk Budi Rp 80.000). 15% membuka modal PIN dokter/admin; prototipe menerima 6 angka apa saja (mis. 123456), PIN tidak disimpan.
- **Saldo deposit** lintas kunjungan bisa dipakai untuk tagihan atau sisa tagihan.
- **Sisa tagihan bukan cicilan formal**: Dewi Lestari, mahkota 21, total Rp 2.500.000, sudah dibayar Rp 2.000.000, sisa Rp 500.000, jatuh tempo 21 Nov 2026. Bisa dilunasi kapan saja, termasuk dari deposit.
- **Void/refund** selalu wajib alasan (pilihan + catatan; catatan wajib untuk "Lainnya"). Kasir boleh sampai **Rp 500.000**; di atasnya ada langkah **PIN pemilik** (6 angka apa saja di prototipe). Pengembalian lewat tunai dari laci, saldo deposit, atau transfer. Refund tunai mengurangi kas sistem di Laporan dan Tutup Shift. Total refund dibatasi sebesar jumlah yang dibayar.
- **QRIS/EDC/Transfer tidak masuk laci.**
- Komisi dokter 40% dari tarif tindakan bertanda tangan **sebelum** diskon.
- **Pemilik di Laporan Kasir hanya melihat**: ada banner "Hanya lihat", tanpa tombol Tutup Shift dan tanpa field yang bisa diubah.
- Pengingat WhatsApp hanya pratinjau outbox, tanpa isi klinis, hanya untuk pasien yang memberi izin.

## Angka cerita (Sabtu, 14 Nov 2026, ±20.30 WIB)
Klinik Gigi Senyum Sehat, Jl. Tebet Raya No. 21, Jakarta Selatan. Kasir Sari Front Desk, shift buka 08.00, kas awal Rp 500.000.

| | |
|---|---|
| Budi Santoso (TG-2026-11014-001) | 36-O komposit Rp 450.000 + ekstraksi 48 Rp 350.000 = Rp 800.000; diskon Rp 0; deposit −Rp 200.000; **sisa Rp 600.000** (tunai, uang pas) |
| Sebelum Budi bayar (Antrean) | Tunai Rp 450.000 (Hendra) + QRIS Rp 400.000 (Joko) = diterima Rp 850.000; laci Rp 950.000 |
| Setelah Budi bayar (Laporan) | Tunai Rp 1.050.000 (2) + QRIS Rp 400.000 (1) = Rp 1.450.000; kas akhir sistem Rp 1.550.000 |
| Total tagihan hari ini | Rp 1.650.000 (3 lunas) · rata-rata Rp 550.000 |

## Buka / Tutup Shift
- Hitung per pecahan: kertas 100.000, 50.000, 20.000, 10.000, 5.000, 2.000, 1.000; koin 1.000, 500, 200, 100. Tiap baris: tombol −/+ (44px), kolom angka, subtotal. Total dihitung langsung.
- **Buka shift**: contoh hitungan Rp 500.000; beda dari standar diberi tanda.
- **Tutup shift**: seharusnya di laci = kas awal + tunai masuk − refund tunai; dihitung; selisih; **alasan wajib** bila selisih ≠ 0; non-tunai (QRIS/EDC/Transfer) dan saldo deposit dipisah karena tidak di laci; lalu ringkasan "Shift ditutup". Layar ini rancangan sendiri (Mobbin tidak punya Z-report).

## Ukuran layar
- **1440×900**: tata letak penuh, sidebar 248px.
- **Tablet 901–1199px (mis. 1024×768)**: sidebar jadi rel ikon 72px; mode charge tetap dua kolom (metode | keypad) dan tombol Terima terlihat tanpa gulir.
- **≤ 900px**: tanpa sidebar, kolom bertumpuk. **≤ 600px (390)**: ubin metode jadi deretan geser, keypad dominan, tombol Terima menempel di bawah; tagihan punya bilah Bayar di bawah. Di mode charge, topbar dan spanduk “data sintetis” disembunyikan supaya keypad terlihat tanpa gulir; pengalih peran/layar tetap ada.
- Target sentuh ≥ 44px; keypad ≥ 56px.

## Catatan
- Bilah sisi mengikuti peran. Beranda/Jadwal/Pasien tampil tetapi nonaktif — prototipe ini hanya Kasir.
- `app.js` punya `console.assert` kecil: Budi diskon 0 dan sisa Rp 600.000; contoh pecahan buka = Rp 500.000 dan tutup = kas sistem.
- Waktu layar dibekukan di Sabtu, 14 November 2026, sekitar pukul 20.30 WIB.
