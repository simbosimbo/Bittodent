# Prototipe Kasir — Bittodent (statis)

**DATA SINTETIS — prototipe desain, bukan aplikasi produksi.** Semua nama, nomor tagihan, dan angka dikarang. Nomor WA `0800-000-0000` adalah nomor contoh.

## Cara membuka
Buka `index.html` langsung di browser, atau `python3 -m http.server` di folder ini lalu buka `http://localhost:8000/`. Tanpa build, tanpa npm. Font Plus Jakarta Sans dimuat dari Google Fonts (tanpa internet → fallback font sistem).

## Pengalih (bilah kuning di atas)
- **Peran**: Kasir/FO · Dokter · Pemilik → daftar **Layar** ikut berubah, sorotan sidebar & chip pengguna ikut berubah.
- Tautan langsung: `index.html#tagihan` atau `index.html?layar=2`.

| # | Layar | Hash |
|---|---|---|
| 1 | Antrean Kasir | `#antrean` |
| 2 | Detail Tagihan & Bayar | `#tagihan` |
| 3 | Lunas (terkunci, void/refund) | `#lunas` |
| 4 | Struk 58/80 mm/A5 + SALINAN | `#struk` |
| 5 | Laporan Kasir (rekap shift, harian, piutang) | `#laporan` |
| 6 | Persetujuan Diskon (modal PIN di atas tagihan) | `#diskon` |
| 7 | Pendapatan Saya (drg. Nadia Putri) | `#pendapatan` |
| 8 | Dashboard Keuangan | `#keuangan` |
| 9 | Audit void/refund & selisih kas | `#audit` |
| 10 | Tarif & Kebijakan | `#tarif` |

Layar 1, 2, dan 7 dirancang juga untuk 390×844.

## Aturan yang tertanam
- Tagihan dibuat dari **tindakan yang sudah ditandatangani dokter hari ini**; tanpa rencana perawatan.
- **Temuan odontogram tidak ditagihkan** (karies, gigi hilang, sisa akar) — hanya tindakan bertanda tangan.
- Semua pasien **Umum**; tidak ada asuransi/BPJS.
- **Saldo deposit** pasien terlihat di antrean, tagihan, dan panel bayar.
- Pengingat WA untuk piutang/tagihan belum bayar: hanya pratinjau, tanpa isi klinis.

## Pratinjau
```bash
python3 -m http.server 43633 --bind 127.0.0.1
# lalu buka http://127.0.0.1:43633/
```

Cuplikan layar (di luar repositori, mesin kerja): `/workspace/audit/kasir-prototype/`
(`01-antrean.png`–`10-tarif.png`, plus `m-antrean.png`, `m-tagihan.png`, `m-pendapatan.png`, dan varian struk/laporan).

## Catatan desain
- Bilah sisi mengikuti peran (Kasir: Kasir + Laporan; Dokter: Pendapatan Saya; Pemilik: Laporan, Keuangan, Audit, Tarif). Beranda/Jadwal/Pasien tampil tetapi nonaktif — prototipe ini hanya Kasir.
- Panel bayar menempel di desktop; di 390px menjadi bilah bawah tetap.
- Batas diskon kasir 10% atau Rp 100.000 (yang lebih kecil). 15% membuka modal PIN dokter. Prototipe menerima 6 digit apa pun (contoh 123456); PIN tidak disimpan.
- Komisi dihitung dari tarif tindakan bertanda tangan **sebelum** diskon.
- Pengingat WhatsApp hanya pratinjau outbox, tanpa isi klinis; nomor `0800-000-0000` adalah contoh.
- Waktu layar dibekukan di Sabtu, 14 November 2026, sekitar pukul 20.30 WIB (cerita shift malam).
