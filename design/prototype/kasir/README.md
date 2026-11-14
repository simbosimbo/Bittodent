# Prototipe Kasir (statis)

DATA SINTETIS. Semua nama, nomor, dan angka dikarang. HTML + CSS + JS biasa, tanpa build. Pola POS: [RESEARCH-POS.md](RESEARCH-POS.md).

## Cara membuka
```bash
cd design/prototype/kasir
python3 -m http.server 8000 --bind 127.0.0.1
# buka http://127.0.0.1:8000/
```
Atau buka `index.html` langsung.

## Layar
Pilih peran dan layar di bilah kuning. Tautan langsung: `#bayar` atau `?layar=4`. Setiap layar punya `id="screen-…"`.

| # | Layar | Hash | Peran |
|---|---|---|---|
| 1 | Antrean Kasir | `#antrean` | Kasir |
| 2 | Buka Shift | `#buka-shift` | Kasir |
| 3 | Tagihan | `#tagihan` | Kasir |
| 4 | Bayar | `#bayar` | Kasir |
| 5 | Lunas | `#lunas` | Kasir |
| 6 | Struk | `#struk` | Kasir |
| 7 | Void / Refund | `#refund` | Kasir |
| 8 | Tutup Shift | `#tutup-shift` | Kasir |
| 9 | Laporan Kasir | `#laporan` | Kasir |
| 10 | Persetujuan Diskon | `#diskon` | Dokter |
| 11 | Pendapatan Saya | `#pendapatan` | Dokter |
| 12 | Laporan Kasir (hanya lihat) | `#laporan-pemilik` | Pemilik |
| 13 | Keuangan | `#keuangan` | Pemilik |
| 14 | Audit | `#audit` | Pemilik |
| 15 | Tarif & Kebijakan | `#tarif` | Pemilik |

## Demo
- `?demo=refund-tunai`: dibayar Tunai Rp 600.000, refund dari laci.
- `?demo=refund-qris`: dibayar QRIS, form rekening tampil.
- `?demo=refund-split`: Tunai Rp 200.000 + QRIS Rp 400.000, dibagi proporsional.
- `?demo=void-done`: void penuh dicatat lewat PIN pemilik, deposit kembali.
- `?demo=void-audit`: Audit dengan baris void hari ini.

## Aturan
- Tagihan hanya dari tindakan bertanda tangan. Temuan odontogram tidak ditagih.
- Semua pasien Umum. Belum ada asuransi/BPJS.
- Diskon bawaan 0%. Kasir maks. 10% atau Rp 100.000 (yang lebih kecil). Di atasnya PIN dokter/admin.
- QRIS/EDC/Transfer tidak masuk laci.
- Void/refund wajib alasan. Kasir sampai Rp 500.000; di atasnya PIN pemilik (deposit tidak dihitung).
- Refund mengikuti metode bayar asli. Tunai dari laci; non-tunai lewat transfer ke rekening pasien.
- Split dibagi proporsional (contoh: refund 300.000 dari 200k+400k = 100k+200k).
- Void penuh mengembalikan deposit ke saldo pasien. Refund sebagian tidak.
- Tutup shift: selisih kas ≠ 0 wajib alasan.
- Pemilik di Laporan Kasir hanya lihat.
- Komisi dokter 40% dari tarif, sebelum diskon.
- WhatsApp hanya pratinjau, pasien yang memberi izin, tanpa isi klinis.
- PIN prototipe: 6 angka apa saja, tidak disimpan.
