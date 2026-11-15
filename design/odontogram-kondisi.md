# Kondisi odontogram Bittodent

Taksonomi dan simbol bagan 2D (input) dan tampilan 3D (baca). Mengikuti **Panduan Rekam Medis Kedokteran Gigi, Kemenkes dan PB PDGI (2015)**, hlm. 13-19: [PDF](https://dental.id/wp-content/uploads/2016/08/PANDUAN-REKAM-MEDIS-DOKTER-GIGI.pdf). Papan: `design/boards/odontogram-v2.html`. Review asal: `/workspace/audit/odontogram-v2/review-klinis-grid.md`.

## Dasar

- **Permenkes 269/2008** Pasal 3: rekam medis kasus gigi wajib odontogram klinik. Simbol tidak dirinci di sana; rinciannya di Panduan 2015.
- **FDI**: tetap 11-18, 21-28, 31-38, 41-48. Sulung 51-55, 61-65, 71-75, 81-85. Kanan/kiri = sisi pasien.
- **Permukaan MODVL**: M mesial, O oklusal (I insisal pada anterior), D distal, **V vestibular/bukal/labial**, L lingual/palatal. Kunci data permukaan bukal diganti `B` ke `V` (migrasi data: alias `B` dibaca sebagai `V`).
- **Penulisan**: permukaan kapital di depan, kondisi huruf kecil, gabungan dengan tanda hubung. Contoh `36: O car`, `46: MOD amf`, `16: O cof-rct`, `45: mis-pon-pob`, `prd-acr`. Kode selalu huruf kecil di UI (tanpa `text-transform: uppercase`).
- **Di luar daftar**: ditulis dalam tanda kutip, bukan kode baru. Contoh `12: cfr "1/2 insisal"`.
- **Gigi sehat** ditulis `sou`, jangan dikosongkan.
- **Aturan isi**: seluruh gigi diperiksa dan dicatat pada kunjungan pertama. Selama perawatan belum mencapai restorasi tetap, odontogram tidak diubah; tindakan harian masuk tabel perawatan. Setelah restorasi tetap: koreksi + paraf + tanggal. Kunjungan terakhir lebih dari 1 tahun: odontogram baru.

## Warna

- **Bawaan hitam-putih (resmi)**: amalgam/logam hitam penuh, restorasi sewarna gigi diarsir.
- **Opsional** (Pengaturan, Rekam medis, Lanjutan): logam emas merah, amalgam/logam hitam, sewarna gigi hijau, sealant merah muda.
- Warna **tidak** dipakai untuk status. Merah = rencana dan biru = selesai adalah kebiasaan charting Amerika, bukan PDGI. Hijau resmi berarti sewarna gigi.

## Status (lapisan produk)

Bukan kolom formulir PDGI. Dibedakan lewat bentuk garis dan lencana, tanpa warna:

| Kunci | Label | Tanda di bagan |
|---|---|---|
| `ada_sebelumnya` | Ada sebelumnya | garis utuh, tanpa lencana (bawaan pemeriksaan awal) |
| `klinik_lain` | Klinik lain | garis utuh + lencana `L` |
| `rencana` | Rencana | simbol digambar garis putus, tanpa isi |
| `selesai` | Selesai | garis utuh + lencana centang |

## Kondisi

Total **30 kondisi** + baseline `sou`, ditambah 2 peran rentang dan 2 bahan protesa. Ikon di UI = simbol resmi 28px (bukan titik warna).

### Permukaan (10), wajib MODVL

| Kunci | Label | Kode | Simbol resmi |
|---|---|---|---|
| `karies` | Karies (juga tambalan sementara) | car | garis batas tebal pada permukaan |
| `tambalan_amalgam` | Tambalan amalgam | amf | permukaan hitam penuh |
| `tambalan_komposit` | Tambalan komposit | cof | permukaan diarsir |
| `tambalan_gic` | Tambalan GIC | gif | diarsir, dirinci di tabel |
| `sealant` | Pit dan fissure sealant | fis | arsir silang (opsional merah muda) |
| `inlay` | Inlay | inl | digambar seperti tambalan, dirinci di tabel |
| `onlay` | Onlay | onl | seperti tambalan, dirinci di tabel |
| `fraktur` | Fraktur mahkota | cfr | tanda # |
| `abrasi` | Abrasi | abr | kode teks |
| `atrisi` | Atrisi | att | kode teks |

### Seluruh gigi (15)

| Kunci | Label | Kode | Simbol resmi |
|---|---|---|---|
| `non_vital` | Gigi non-vital | nvt | segitiga akar kosong |
| `psa` | Perawatan saluran akar | rct | segitiga akar hitam (gabung: `amf-rct`, `poc-rct`) |
| `mahkota_logam` | Mahkota logam | fmc | bingkai tebal |
| `mahkota_porselen` | Mahkota porselen | poc | bingkai tebal + arsir |
| `mahkota_metal_porselen` | Mahkota metal porselen | mpc | bingkai tebal + arsir (dirinci di tabel) |
| `mahkota_emas` | Mahkota emas | gmc | bingkai tebal (opsional merah) |
| `sisa_akar` | Sisa akar | rrx | garis V |
| `hilang` | Gigi hilang | mis | silang |
| `tidak_diketahui` | Tidak ada, tidak diketahui | non | kode teks |
| `belum_erupsi` | Belum erupsi | une | kode teks |
| `erupsi_sebagian` | Erupsi sebagian | pre | kode teks |
| `impaksi` | Impaksi visible | imv | kode teks |
| `anomali` | Anomali (peg shape, mikro, fusi) | ano | kode teks |
| `diastema` | Diastema | dia | kode teks, lebar dicatat |
| `migrasi` | Migrasi, versi, rotasi | (panah) | panah sesuai arah, tanpa singkatan |

### Rentang dan protesa (4)

| Kunci | Label | Kode | Simbol resmi |
|---|---|---|---|
| `jembatan_logam` | Jembatan logam | meb | batang penghubung di atas rentang |
| `jembatan_porselen` | Jembatan porselen | pob | batang + bingkai tebal arsir |
| `gts` | Gigi tiruan sebagian | prd | silang + kode |
| `gtl` | Gigi tiruan lengkap | fld | silang + kode |

Peran per gigi di rentang: `pon` pontik (ditulis `mis-pon-pob`), `abu` gigi penyangga. Bahan protesa: `acr` akrilik (`prd-acr`), `frm` frame.

### Implan (1)

| Kunci | Label | Kode | Simbol resmi |
|---|---|---|---|
| `implan` | Implan | ipx | bingkai + kode `ipx` (dengan mahkota: `ipx-poc`) |

### Perubahan dari v2

- Ditambah: `nvt`, `non`, `ano`, `gmc`, `meb`, `pob`, `acr`, `frm`, migrasi (panah).
- Kode diganti: `imp` ke `ipx`, `at` ke `att`, permukaan `B` ke `V`.
- Bridge `pon`/`abu` jadi peran di dalam `meb`/`pob`.
- Dihapus sebagai kode (jadi catatan bebas dalam kutip): erosi (`ero`), goyang (`mob`), veneer (`ven`), splint (`spl`), bracket orto (`brk`), sulung persisten (`per`, dicatat lewat nomor sulung 5x-8x). Perlu dicabut (`ext`) bukan simbol bagan: masuk tabel perawatan sebagai rencana tindakan.

## 2D atau 3D

**2D input utama.** Sel gigi 48x64 px, simbol 40x40 (diukur di papan, Playwright). HP: satu penggulir horizontal untuk dua rahang (18 sejajar 48), dibuka di garis tengah, minimap posisi. Desktop 1280: 32 gigi muat tanpa geser. Toggle **Tetap | Sulung | Campuran** (48px); bawaan dari umur, campuran = 4 baris, sulung di bawah penggantinya.

**3D hanya baca** (ringkasan, edukasi). Render `Odontogram3D` terbaru. Gerak dikurangi atau gagal muat: tetap 2D. Toggle 2D | 3D tinggi 48.

## Cara input

### Mode Perawatan (bawaan, tooth-first)

1. Ketuk gigi. Sheet terbuka; bagan menyempit ke rahang gigi itu.
2. Tab Permukaan, Seluruh gigi, atau Rentang.
3. Permukaan: pad MODVL 56px, lalu **RadioGroup kartu 2 kolom** (5 tersering + "5 lainnya"). Seluruh gigi: **Listbox** multi-pilih (gabungan dengan tanda hubung), cari di header sheet. Rentang: RadioGroup kartu, ketuk gigi pertama dan terakhir, peran otomatis.
4. Status: segmented Ada / Lain / Rencana / Selesai.
5. Satu tombol primer dengan catatan resmi: `Simpan 26 O car`.

### Mode Pemeriksaan awal (palet)

1. Pilih alat sekali (strip alat tersering + Semua).
2. Ketuk banyak gigi. Alat seluruh gigi langsung tercatat; alat permukaan membuka pad MODVL kecil.
3. Tandai sisa `sou`, lalu Simpan sekali, paraf dan tanggal.

| Skenario | Tooth-first | Palet |
|---|---|---|
| Karies 36 O | 5 | 4 |
| Tambalan 47 MOD amf | 7 | 6 |
| 8 hilang + 2 sisa akar | 40-50 | 13 |
| Mulut lengkap (8 mis, 2 rrx, 1 MOD amf, 21 sou) | 130+ | 19 |

## Warna kontrol

Terpilih (gigi, pad, kartu, alat, listbox): garis 2px `primary-800` + latar `primary-50`, sama dengan papan menu-pengaturan-mode. Teal `#0B6B62` hanya tombol primer.

Kode ICD tetap diisi dari aturan cabang dan bisa diubah sebelum rencana disetujui.
