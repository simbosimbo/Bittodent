# Layar AI: spesifikasi implementasi untuk Builder

Papan: `design/boards/ai-layar.html` (build `build_ai_layar.py`). Render: `/workspace/audit/ai-layar/ab-01..05.png`.
Dasar shell: `feat/jadwal-mobile` `0a5ba9e` (top bar ramping 56px, bottom nav 5 kolom, sheet ber-handle). Simbol dan kode odontogram: `odontogram-kondisi.md` (11e6432). Token: `design/tokens.css`.

## Aturan bersama

- Output AI selalu **draf** sampai dokter menyetujui. Kode ICD, tindakan, dan isi ringkasan baru resmi setelah SOAP/ringkasan ditandatangani atau disetujui oleh dokter.
- Peran tanpa izin: komponen **tidak dirender**. Tanpa gembok, tanpa ruang kosong. Server tetap memeriksa izin.
- Teal `primary-700` (#0B6B62) hanya untuk tombol primer terisi. Satu primer per layar. Kontrol terpilih memakai `primary-800` di atas `primary-50`.
- Warna sebagai sinyal, selalu dengan ikon + label: draf `draft-*`, periksa `warning-*`, tolak/tidak cocok `danger-*`, disetujui `success-*`.
- Target sentuh 48. Grid 8pt (8/16/24). Radius kartu 16, kontrol 14, sheet 16 atas.
- Teks minimal. Bantuan di tombol info, bukan paragraf. Tanpa panduan langkah demi langkah.
- Motion: `--motion-std` 200ms untuk sheet dan toast, `prefers-reduced-motion` = tanpa animasi.
- Badge DATA SINTETIS di top bar selama data sintetis.

## Komponen bersama

| Komponen | Ukuran | Token | State | Perilaku |
|---|---|---|---|---|
| `AiChip` | tinggi 28, pad 0 10, ikon 16, 12px/600, pill | draf: `draft-bg/fg`; periksa: `warning-bg/fg`; tolak: `danger-bg/fg`; disetujui: `success-bg/fg`; Rencana: putih + inset `neutral-200`; Terenkripsi: `neutral-100/700` + gembok | statis | Tidak menambah tinggi baris label. Jika bisa diketuk (Dari pindai), hit area 48 lewat pseudo-elemen. |
| `Segmented` (Semua/Draf/Diulas, Profil/Riwayat/Ringkasan) | track pad 4, radius 12, pil 40 (hit 48 dengan track), radius 8 | track `neutral-100`, terpilih putih + teks `primary-800`, hitungan pil 20 | on/off | `role=radiogroup`. Hitungan disembunyikan saat 0. |
| `AiCard` | radius 16, pad 12 16 16, gap 8, border kiri 4 | kiri: draf `draft-border`, disetujui `success-border`, ditolak `danger-border` + latar `neutral-50` | draf / disetujui / ditolak / tertunda (ditolak + "Dikirim dalam N dtk") | Kartu tidak pindah grup selama 5 dtk tertunda. Setelah itu masuk "sudah diulas" (tertutup default). |
| `CiteButton` | min 48, radius 12, ikon kutip 16 | netral `neutral-200` border; terpilih border 2 `primary-800` + `primary-50` | off/on | Ketuk menyorot gigi/permukaan di odontogram (`.tc.cited`, garis putus `draft-border`). |
| `Toast` (global) | min 48, radius 14, kiri/kanan 16, bawah = tinggi nav + 16 | `neutral-900`, teks putih, aksi `primary-200` | info / undo | Satu host di Shell, z di atas header dan nav. Undo: cincin hitung mundur 5 dtk, aksi Urungkan 48. Satu toast sekaligus, yang baru mengganti yang lama dan mengirim antrean sebelumnya. |
| `Sheet` | radius 16 atas, handle 40×4 (hit 24), pad 8 16, opsi 48 gap 8 | scrim `rgba(16,24,40,.42)` | buka/tutup | Fokus terperangkap, Esc/geser tutup. Tinggi mengikuti isi, maks 70vh lalu gulir di dalam. |
| `Dock` | pad 16 16 + safe area, satu baris | putih, border atas `neutral-200` | | Satu primer lebar penuh. Konten di atasnya punya `padding-bottom` = tinggi dock + 16 dan `scroll-margin-bottom` yang sama. |

## A4 Pasien baru + pindai KTP (ab-01)

| Bagian | Spesifikasi |
|---|---|
| Kamera | Layar penuh gelap, bingkai ID-1 312×197 radius 16 dengan sudut 4px, rana 72. Tutup 48 kiri atas, galeri 48 kiri bawah. Satu kalimat: "Sisi depan, dalam bingkai". OCR di perangkat; gambar tidak diunggah sebelum simpan. |
| Pratinjau | Thumbnail kartu (16:10) di atas form. **NIK digit 7-12 selalu ditutup** dengan pita hitam yang digambar di canvas (bukan CSS overlay), termasuk untuk peran dengan `patient.ktp.view`. Digit ragu diberi garis `warning-border`. Tombol Ulang (ghost, ikon kamera). |
| Banner draf | `draft-bg`, "N isian dari pindai" + Konfirmasi semua (ghost 40, hit 48). Hilang saat N = 0. |
| Field dari pindai | Input latar `draft-bg`, border `draft-border`, chip "Dari pindai" di kanan label. Terkonfirmasi saat diketik, chip diketuk, atau Konfirmasi semua. **Fokus saja tidak mengonfirmasi.** Setelah konfirmasi: input normal, chip "Dicek" (success) 2 dtk lalu hilang. |
| NIK ragu | Border 2 `warning-border`, chip Periksa, hint 12px satu baris ("Digit 5-6 ragu"). Periksa juga untuk NIK yang tidak cocok dengan tanggal lahir/kelamin/wilayah (Tidak cocok, danger). |
| Primer | Tidak pernah disabled. Saat ada draf: "Cek N isian" (gulir dan fokus ke draf berikutnya). Saat N = 0: "Verifikasi dan daftar". Batal = tombol kembali di top bar. |
| Sesudah simpan | Tab Profil. Kartu KTP dengan chip Terenkripsi (pertama kali muncul di sini). NIK tersamar; tombol mata dan Buka foto hanya `patient.ktp.view`. Toast "Pasien terdaftar". |
| Desktop 1280 | Kiri 344: pratinjau + banner. Kanan: form 2 kolom tetap, Prov/Kab/Kec 3 kolom. Aksi di kaki kartu: Batal ghost + primer. |

## A1 Saran ICD (ab-02)

| Bagian | Spesifikasi |
|---|---|
| Kepala | "Saran ICD" 16/700 + tombol info 48. Segmented Semua / Draf N / Diulas N. |
| Kartu | Label sistem netral (ICD-10 dan ICD-9-CM sama warna), kode 16/800 tabular, nama 14. Sitasi `CiteButton`. Aksi: Tolak (danger-soft) · chevron 48 (alasan) · Setujui (secondary + centang). |
| Tolak | Sekali ketuk: kartu berubah Ditolak + "Dikirim dalam N dtk", toast "K02.1 ditolak · Urungkan". Request dikirim setelah 5 dtk, atau saat `pagehide`/`visibilitychange` (keepalive). Setelah sukses: muat ulang data (state server), bukan kembali ke Draf. |
| Alasan | Sheet 16: judul "Tolak K08.3", lima opsi 48 (Tidak sesuai, Sudah dicatat, Terlalu umum, Kode lain, Lainnya). Tinggi ±370px, muat di 360×800 tanpa gulir. Ketuk opsi = Tolak dengan alasan + toast yang sama. Desktop: popover 320. |
| Setujui | Kode masuk A (ICD-10) atau P (ICD-9-CM) di SOAP draf sebagai chip draf. Resmi setelah Tanda Tangani. |
| Desktop | Odontogram lebar penuh di atas. Di bawah: SOAP (flex) + panel 360. Panel sticky dengan `top` = tinggi header terukur. |

## A2 Saran tindakan dari odontogram (ab-03)

| Bagian | Spesifikasi |
|---|---|
| Kartu | Sumber (F1/F2) + Draf AI. Baris: simbol resmi 28 temuan → simbol tindakan 28, nama tindakan 15/700, kecil "47 O · car → cof". Kode huruf kecil, permukaan MODVL dengan V. |
| Odontogram | Gigi yang dikutip: `.tc.cited` garis putus `draft-border` + `draft-bg`. Setelah Setujui: glyph Rencana (garis putus, konvensi v2), bukan Selesai. |
| Setujui semua | Secondary sm di kepala. Tidak pernah teal terisi. |
| Tolak | Pola A1 (5 dtk + Urungkan, antrean yang sama). |
| Primer | Tanda Tangani (dock di atas nav di HP, kaki kartu SOAP di desktop). |

## Ringkasan medis (ab-04)

| Bagian | Spesifikasi |
|---|---|
| Letak | Tab "Ringkasan" di profil pasien (HP), kolom kiri 360 di desktop (gaya CareStack Clinical Summary). |
| Status | Banner draf: "Draf AI · tanggal jam" + info. Banner disetujui: success, "Disetujui {dokter} · tanggal jam". |
| Bagian | Peringatan (selalu atas, terbuka, border `danger-border`), Kondisi medis, Obat rutin, Gigi, Rencana terbuka, Kunjungan terakhir. Kepala 56: ikon 32, judul, hitungan, chevron. Maks 2 baris per bagian, sisanya "+N lainnya". Default: Peringatan, Kondisi, Gigi terbuka; lainnya tertutup di HP. |
| Baris | 48, judul 14/600 + sumber 12. Tombol kutip 48 membuka sheet Sumber (catatan asal, tanggal, penulis) dengan Hapus dari draf (danger-soft) dan Ubah (secondary). |
| Primer | HP: "Setujui ringkasan" di dock. Desktop: "Setujui" di banner draf. Tidak ada primer setelah disetujui. |
| Pembaruan | Data klinis baru membuat draf baru. Versi disetujui tetap tampil sampai draf baru disetujui. |

## Peran (ab-05)

| Komponen | Izin | Dokter | Asisten | Resepsionis | Kasir | Pemilik |
|---|---|---|---|---|---|---|
| Saran ICD, Saran tindakan, Ringkasan draf | `ai_draft.review` | ya | tidak dirender | tidak dirender | tidak dirender | tidak dirender |
| Ringkasan disetujui | `clinical.view` | ya | ya | tidak | tidak | ya |
| Pindai KTP | `patient.create` | ya | tidak | ya | tidak | ya |
| Mata NIK, Buka foto | `patient.ktp.view` | ya | tidak | tidak | tidak | ya |

Pemilik dengan peran dokter mengikuti matriks Dokter. Matriks ini UI; server tetap sumber kebenaran.

## Pertanyaan perilaku AI untuk AI Developer

1. **A1/A2 antrean Tolak**: jika dua Tolak berturut-turut dalam 5 dtk, apakah Urungkan hanya membatalkan yang terakhir (desain: ya, yang sebelumnya langsung dikirim)? Bagaimana jika request gagal (409/offline): kartu kembali Draf dengan toast error?
2. **A1 setelah kirim**: apakah endpoint reject mengembalikan item terbaru sehingga UI bisa memperbarui tanpa muat ulang seluruh daftar?
3. **A1 regenerasi**: kapan saran ICD dihitung ulang (setiap simpan SOAP, setiap tanda tangan odontogram)? Apakah saran yang ditolak bisa muncul lagi dengan kode yang sama?
4. **A4 konfirmasi**: setuju bahwa fokus tidak mengonfirmasi, hanya ketik / ketuk chip / Konfirmasi semua?
5. **A4 ambang Periksa**: berapa ambang kepercayaan OCR per field untuk Periksa? Apakah NIK selalu Periksa jika ada digit di bawah ambang, dan digit mana yang dilaporkan (indeks) supaya pratinjau bisa menandainya?
6. **A4 redaksi pratinjau**: apakah canvas yang sama dipakai untuk OCR dan pratinjau tersamar? Pratinjau tidak boleh pernah menampilkan NIK utuh, termasuk dalam objek URL.
7. **A4 dua sisi**: fixture `synthetic-ktp-two-sides.png` tidak menghasilkan draf di run saya. Apakah deteksi kartu depan sudah final, dan apa yang ditampilkan jika kartu tidak terdeteksi (desain: toast "Kartu tidak terbaca" + tetap di kamera)?
8. **A2 Setujui**: apakah Setujui membuat Rencana di odontogram langsung (draf, belum ditandatangani), dan apakah Tolak pada saran A2 juga immutable seperti A1?
9. **Ringkasan**: apa sumber tiap baris (anamnesis, SOAP, odontogram, resep)? Apakah setiap baris membawa sitasi yang bisa ditampilkan di sheet Sumber? Apakah dokter bisa mengubah teks baris atau hanya menghapus?
10. **Ringkasan**: kapan draf baru dibuat (setiap kunjungan ditandatangani, atau on demand)? Berapa lama versi disetujui berlaku?
11. **Saklar berbayar**: saat AI berbayar mati, apakah A1/ringkasan tetap muncul dari aturan (tanpa LLM)? Label yang dipakai tetap "Draf AI" atau "Draf"?
12. **Log**: apakah setiap Setujui/Tolak/Ubah dicatat di `agent_run`/`agent_draft` (#54) dengan alasan, untuk ditampilkan di riwayat?
