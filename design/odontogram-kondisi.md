# Kondisi odontogram Bittodent

Taksonomi untuk bagan 2D (input dokter) dan tampilan 3D (baca/edukasi). Legenda ini internal: mengikuti penomoran FDI dan singkatan yang lazim di rekam medis gigi Indonesia, tetapi **bukan salinan formulir resmi**. Simbol resmi PDGI dapat diganti nanti tanpa mengubah kunci data.

## Dasar hukum dan acuan

- **Permenkes 269/2008** Pasal 3: rekam medis kasus gigi dilengkapi **odontogram klinik**. Peraturan ini mewajibkan adanya odontogram, tidak merinci simbol.
- **Penomoran FDI** (dipakai PDGI): tetap 11-18, 21-28, 31-38, 41-48; sulung 51-55, 61-65, 71-75, 81-85. Kanan/kiri = sisi pasien.
- **Permukaan** (tulisan kapital di depan singkatan): M mesial, O oklusal (I insisal pada anterior), D distal, B bukal/labial (panduan lama memakai V vestibular), L lingual/palatal. Di data Bittodent, id permukaan palatal tetap `L`.
- Singkatan lazim (sou, car, amf, cof, gif, fis, rct, fmc, poc, meb, pon, abu, prd, fld, imp, dan seterusnya) dipakai sebagai **kode tampilan**, bukan sebagai teks undang-undang.
- Produk sejenis (pola, bukan salinan UI): Open Dental dan Dentrix memisahkan kondisi vs tindakan dan mengecat permukaan; CareStack menumpuk status dengan transparansi, membedakan rencana vs selesai, dan menyembunyikan tindakan lain pada gigi hilang. Mobbin tidak punya pola bagan gigi yang kuat.
- Legenda MVP lama (`design/odontogram/legend.json`) hanya 8 kondisi. Dokumen ini memperluasnya. Kode ICD adalah **contoh** untuk yang umum; kode jadi mengikuti `coding_rule` cabang.

## 2D atau 3D

**2D (FDI, 5 permukaan) adalah input utama mode Dokter.** Ketuk gigi lalu permukaan atau seluruh gigi, target 48-56px, cepat di HP, selaras odontogram klinik, dan tidak membebani GPU.

**3D (aset yang sudah ada di `design/odontogram/3d` dan port bagan) adalah tampilan baca:** ringkasan kunjungan dan edukasi pasien. Toggle **2D | 3D** di header bagan. 3D tidak dipakai untuk input (permukaan 5 sisi sulit tepat di mesh, dan mid-range Android mudah patah frame jika 32 gigi di-render WebGL atau SVG berat). 3D dimuat lazy; jika `prefers-reduced-motion` atau gagal muat, tetap 2D.

## Status per kondisi

Status terpisah dari jenis kondisi (warna + bentuk). Empat nilai di sheet. Bukan teal merek `#0B6B62` (teal hanya tombol primer). Kontras teks AA.

| Kunci | Label | Ikon | Warna teks / latar | Arti |
|---|---|---|---|---|
| `ada_sebelumnya` | Ada sebelumnya | kotak isi | `#344054` / `#EEF0F4` | Sudah ada di pasien, dicatat di klinik ini |
| `klinik_lain` | Dikerjakan klinik lain | kotak kosong | `#1D4ED8` / `#E8F0FE` | Dikerjakan di luar, hanya dicatat |
| `rencana` | Rencana | segitiga, garis putus | `#B54708` / `#FFFAEB` | Akan dikerjakan |
| `selesai_hari_ini` | Selesai hari ini | centang | `#0B7A45` / `#ECFDF3` | Selesai pada kunjungan ini |

Opsional kemudian: `dirujuk` (tidak di radio utama).

## Kelompok kondisi

Jumlah di bawah **tidak termasuk** `sehat` (sou), yang hanya baseline "tidak ada kelainan". Total kondisi tercatat: **33**.

### Permukaan (9)

Berlaku pada M, O/I, D, B, L. Wajib pilih permukaan.

| Kunci | Label | Kode | Tanda 2D | ICD-10 (dx) | ICD-9-CM (tindakan, contoh) |
|---|---|---|---|---|---|
| `karies` | Karies | car | isi + titik, `#BE123C` | K02.9 (K02.1 dentin) | 23.2 tumpatan, bila dirawat |
| `tambalan_amalgam` | Tambalan amalgam | amf | isi solid gelap `#1A1A1A` | Z97.2 atau riwayat K02 | 23.2 |
| `tambalan_komposit` | Tambalan komposit | cof | isi solid `#0B7A45` | sama | 23.2 |
| `tambalan_gic` | Tambalan GIC | gif | isi solid `#0E7490` | sama | 23.2 |
| `sealant` | Sealant | fis | isi muda + huruf S, `#9D174D` | Z29.8 pencegahan | 23.2 |
| `abrasi` | Abrasi | abr | arsir tepi, `#92400E` | K03.1 | sesuai rencana |
| `erosi` | Erosi | ero | arsir halus, `#B45309` | K03.2 | sesuai rencana |
| `atrisi` | Atrisi | at | datar oklusal, `#7A5C00` | K03.0 | sesuai rencana |
| `fraktur` | Fraktur | cfr | zigzag, `#9F1239` | K03.81 atau S02.5 | sesuai rencana |

### Seluruh gigi (17)

Tanpa permukaan, atau permukaan opsional (misalnya fraktur sudah di kelompok atas).

| Kunci | Label | Kode | Tanda 2D | ICD-10 | ICD-9-CM (contoh) |
|---|---|---|---|---|---|
| `mahkota_logam` | Mahkota logam | fmc | cincin `#6B7280` | Z97.2 | 23.41 |
| `mahkota_porselen` | Mahkota porselen | poc | cincin `#6D28D9` | Z97.2 | 23.41 |
| `mahkota_metal_porselen` | Mahkota metal porselen | mpc | cincin ganda | Z97.2 | 23.41 |
| `veneer` | Veneer | ven | pita labial `#7C3AED` | Z97.2 | 23.49 |
| `inlay` | Inlay | inl | kotak dalam permukaan | Z97.2 | 23.3 |
| `onlay` | Onlay | onl | kotak + tepi kuspid | Z97.2 | 23.3 |
| `psa` | Perawatan saluran akar | rct | garis vertikal akar `#1E40AF` | K04.1 / K04.0 | 23.43 |
| `sisa_akar` | Sisa akar | rrx | huruf V terbalik `#9A3412` | K08.3 | 23.11 |
| `hilang` | Hilang | mis | silang `#3F3F46` | K08.1 | - |
| `perlu_dicabut` | Perlu dicabut | - | garis miring `#A15C00` | sesuai dx | 23.09 |
| `goyang` | Goyang (mobilitas) | mob | I / II / III `#B54708` | K05.3 | sesuai rencana |
| `impaksi` | Impaksi | imv | panah miring `#0F5F63` | K01.1 | 23.19 |
| `belum_erupsi` | Belum erupsi | une | kerangka putus `#5F6C77` | K00.6 | - |
| `erupsi_sebagian` | Erupsi sebagian | pre | setengah kerangka | K00.6 | - |
| `sulung_persisten` | Gigi sulung persisten | per | angka sulung + kunci | K00.6 | sesuai rencana |
| `diastema` | Diastema | dia | celah antar gigi | K07.2 | - |
| `malposisi` | Rotasi / malposisi | mal | anak panah putar | K07.3 | sesuai rencana |

### Multi-gigi / rentang (6)

Dipilih dengan mengetuk dua atau lebih gigi di bagan. Rentang tersorot. Pontic dan abutment adalah peran pada gigi di rentang, bukan tab terpisah.

| Kunci | Label | Kode | Tanda 2D | ICD-10 | ICD-9-CM (contoh) |
|---|---|---|---|---|---|
| `bridge_pontic` | Bridge, pontic | pon | kotak gantung + batang | Z97.2 | 23.42 |
| `bridge_abutment` | Bridge, abutment | abu | cincin + batang ke pontic | Z97.2 | 23.42 |
| `splint` | Splint | spl | batang pengikat | sesuai dx | 23.49 |
| `gts` | Gigi tiruan sebagian | prd | kurung rentang `#344054` | Z97.2 | 23.6 (contoh) |
| `gtp` | Gigi tiruan penuh | fld | kurung satu rahang | Z97.2 | 23.6 (contoh) |
| `orto_bracket` | Orto, bracket | brk | kotak kecil labial `#0E7490` | Z46.4 | sesuai rencana |

### Implan (1)

| Kunci | Label | Kode | Tanda 2D | ICD-10 | ICD-9-CM (contoh) |
|---|---|---|---|---|---|
| `implan` | Implan | imp | sekrup `#0F5F63` | Z96.5 | 23.5 |

Mahkota di atas implan = `implan` + salah satu `mahkota_*` sebagai lapisan terpisah, masing-masing berstatus sendiri.

## Ringkasan jumlah

| Kelompok | Jumlah |
|---|---|
| Permukaan | 9 |
| Seluruh gigi | 17 |
| Multi-gigi / rentang | 6 |
| Implan | 1 |
| **Total kondisi** | **33** |
| Baseline sehat (sou) | 1, tidak dihitung di total |

## Cara input (mode Dokter)

1. Ketuk gigi di bagan **2D**. Sheet (drawer bawah) terbuka.
2. Tab: Permukaan, Seluruh gigi, atau Rentang. Tanpa nomor stepper.
3. Cari kondisi, atau pilih Favorit / terakhir dipakai di atas daftar.
4. Permukaan: ketuk pad 56px. Rentang: ketuk gigi lain di bagan untuk abutment atau pontic; rentang tersorot.
5. Pilih status (radio). Satu tombol primer: Simpan.

Kode ICD diisi otomatis dari aturan cabang, tetap bisa diubah sebelum Setujui rencana.
