# Pencitraan diagnostik: format, kompresi lossless, dan enkripsi selubung

Status: draf di cabang `bench/scale`. Ini rancangan plus hasil mikro-benchmark di kotak ini (14 Nov 2026, Asia/Jakarta). Bukan nasihat hukum. Angka memakai **citra sintetis** yang diberi label `SYNTHETIC` — bukan radiograf klinis, bukan data pasien.

Keputusan codec lossless yang diadopsi menunggu angka di bawah; klaim pra-ukur ada di `tools/bench/CLAIMS.md` (C8).

## 1. Prinsip yang tidak ditawar

1. **Asli diagnostik hanya lossless.** Thumbnail/preview UI adalah berkas terpisah, boleh lossy, dan tidak pernah menggantikan asli. Menyimpan “hanya JPEG lossy” untuk rontgen diagnostik ditolak.
2. **Urutan: kompres dulu, baru enkripsi.** Mengenkripsi piksel mentah menghabiskan ruang; mengompresi ciphertext hampir tidak mengecil. Integritas (SHA-256 plaintext terkompresi) masuk AAD GCM agar bit-flip gagal didekripsi.
3. **Enkripsi selubung per berkas:** DEK acak per objek, AES-256-GCM, DEK dibungkus kunci penyewa (KEK) dari KMS. KEK tidak disimpan di aplikasi dalam bentuk mentah di produksi.
4. **Setiap buka/unduh tertulis di `audit_event`** (aksi `baca` / `baca_miniatur` / `unduh` / `unggah`, `entity_type=image`, tanpa isi piksel, tanpa tag PHI).
5. **Metadata PHI dilepas sebelum objek disimpan** (EXIF; tag DICOM pasien). Tag teknis yang dibutuhkan viewer (bits, photometric, pixel spacing, window) boleh dipertahankan.
6. **Retensi ≥ 25 tahun** sejak kunjungan terakhir, mengikuti D-005 / Permenkes 24/2022 Pasal 39 yang sudah dikutip di `docs/architecture/ARCHITECTURE.md`. Tidak ada hapus otomatis. Jendela panas 10 tahun (D-046) tidak memendekkan retensi objek rontgen.

## 2. Format sumber (DICOM vs JPEG/PNG)

Praktik klinik gigi mencampur dua dunia:

| Jenis                             | Sumber tipikal                         | Yang kita terima sebagai asli diagnostik | Catatan |
| --------------------------------- | -------------------------------------- | ---------------------------------------- | ------- |
| Intraoral / periapikal            | Sensor (sering JPEG/PNG/TIFF, kadang DICOM IO) | Lossless (TIFF/PNG/JPEG-XL/J2K lossless, atau DICOM lossless) | JPEG lossy dari kamera intraoral = **preview**, bukan asli, kecuali SOP klinik menyatakan itu satu-satunya keluaran sensor (dicatat di audit + UI). |
| Panoramik                         | Unit pano: sering DICOM PX, ~2900×1400, 12–16 bit | DICOM lossless atau turunan lossless     | Ukuran acuan bench: 2900×1400. |
| Sefalometri                       | Unit ceph: DICOM, 12–16 bit            | sama                                     | — |
| Foto klinis / selfie / inklud     | Ponsel/kamera, JPEG                    | Boleh JPEG (bukan diagnostik radiograf)  | Tetap dienkripsi; retensi mengikuti kebijakan foto, bukan Pasal 39 rontgen, *perlu dicek*. |

DICOM tidak wajib untuk setiap berkas, tetapi **jika sumbernya DICOM, jangan transcode ke JPEG lossy.** Simpan SOP Instance setelah sanitasi, atau transcode **hanya** ke codec lossless yang diukur di sini (lalu buang piksel mentah). Encapsulated JPEG lossy di dalam DICOM, jika itu satu-satunya yang dikirim alat, disimpan apa adanya dan ditandai `source_lossy=true` di metadata — tidak dijadikan dalih untuk membuang asli lossless bila masih ada.

Tidak ada modul `file_object` di `main` saat draf ini ditulis; prototipe bench hidup di `POST/GET /api/bench/images` (hanya jika `BENCH_ENDPOINTS=true`).

## 3. Kompresi

### 3.1 Asli diagnostik (wajib lossless)

Kandidat yang diukur (lihat §7):

- JPEG-XL lossless (`cjxl -d 0`)
- JPEG 2000 lossless (`opj_compress` tanpa rasio)
- PNG 16-bit
- Piksel mentah little-endian + zstd (bukan format tampilan; pembanding)

Pilih pemenang berdasarkan rasio × waktu encode pada citra 12/16-bit sintetis berukuran pano/periapikal, plus ketersediaan decoder di viewer. Satu codec “resmi” untuk asli; yang lain boleh tetap sebagai opsi impor.

### 3.2 Thumbnail / preview (lossy, berkas terpisah)

- JPEG q≈70, sisi panjang ~400 px, atau JPEG-XL distance 1.0 pada resolusi yang sama.
- Dihasilkan saat unggah, disimpan sebagai objek kedua (`kind=thumb`), juga dienkripsi.
- UI daftar/odontogram hanya menarik thumb; viewer diagnostik menarik asli lewat dekripsi beraliran.

## 4. Enkripsi selubung

```
master / KMS
  └─ KEK per penyewa (rotate-able)
       └─ bungkus DEK per berkas (AES-256-GCM)
            └─ ciphertext berbingkai (chunk 1 MiB, AES-256-GCM, IV = nonce berkas 8 B + indeks chunk)

AAD per chunk: bittodent:v1:{file_id}:{tenant_id}:{sha256_hex}:{chunk_index}
```

Implementasi prototipe: `app/Bench/Support/FileEnvelope.php` (magic `BTD1`). Di bench, “KMS” diganti HMAC(`ENCRYPTION_KEY`, `bittodent:kek:v1:{tenant_id}`). **Itu bukan KMS.** Produksi wajib KMS sungguhan (per-tenant key, rotasi, hak akses terpisah dari `APP_KEY` / kunci kolom), sesuai catatan di `config/ehr.php`.

Alasan chunked GCM: GCM utuh memaksa menahan seluruh objek sebelum tag terverifikasi. Dengan bingkai 1 MiB, viewer boleh mulai menampilkan setelah tag bingkai pertama sah (latensi byte pertama), tetap menolak objek jika hash keseluruhan tidak cocok di akhir.

Dekripsi gagal (tag/hash/KEK) = 404/409 ke klien, baris audit `baca_gagal`, bukan tumpahan error kriptografi.

## 5. Aliran unggah dan buka

1. Klien atau worker mencopot EXIF / tag DICOM PHI (nama, ID, lahir, alamat, operator bila dianggap PHI, dll.). Daftar tag pasti *perlu dicek* terhadap profil DICOM dental dan UU PDP.
2. Encode lossless (atau terima bitstream lossless yang sudah diverifikasi putar-balik piksel).
3. Hitung SHA-256, bungkus selubung, unggah ke objek storage (di bench: disk lokal `storage/app/bench-images/`).
4. Metadata aplikasi (bukan di EXIF): `id`, `tenant_id`, `codec`, `kind`, `sha256`, ukuran, lebar/tinggi/bit, `label`, `retention_until` (≥ 25 tahun dari kunjungan terkait).
5. Buka: otorisasi (`note.read` atau izin imaging yang lebih sempit, nanti), audit `baca`, stream-dekripsi, decoder di server atau di klien (lebih baik decode di klien setelah chunk terverifikasi, agar CPU server tidak jadi limiter).
6. Unduh asli: audit `unduh`, alasan opsional, sama-sama streaming.

## 6. Retensi dan siklus hidup

- Retensi hukum objek rontgen diagnostik: **≥ 25 tahun** sejak kunjungan terakhir (D-005), bukan 10 tahun. 10 tahun adalah jendela panas operasional (D-046).
- Setelah A5 (≈ 100 rontgen/klinik/tahun × ≈ 3 MiB), volume berkas 25 tahun tetap kecil dibanding `audit_event` pada plafon 10.000 pasien; tier dingin (D-047) tetap opsional.
- Legal hold dan permintaan hapus UU PDP vs retensi Pasal 39: belum diputus (Q-22/Q-23 sisa), *perlu dicek*.

## 7. Hasil mikro-benchmark (citra sintetis)

Metode: `tools/bench/imaging_bench.py`. Dua kerangka 12-bit di wadah 16-bit: panoramic 2900×1400 dan periapikal 1500×1000, noise tulang + busur rahang + label teks `SYNTHETIC - NOT A CLINICAL IMAGE - BITTODENT BENCH`. 1 pemanasan dibuang, 5 ulangan, p50 + min–max. Putar-balik lossless wajib identik piksel; selubung wajib gagal jika satu bit dijungkirkan.

Klaim C8 sebelum ukur: JPEG-XL lossless mengalahkan PNG, setara atau lebih baik dari JPEG 2000 pada rasio; encode pano < 1 s; GCM menambah overhead tetap, bukan persentase; dekripsi tidak mendominasi waktu buka.


Klaim C8: **diterima dengan catatan.** JPEG-XL lossless menang rasio di kedua ukuran; encode pano 459 ms (di bawah 1 s). Encode periapikal JPEG-XL (840 ms) lebih lambat dari JPEG 2000 (225 ms) meski rasio tetap unggul — waktu encode bukan fungsi linier sederhana dari jumlah piksel (effort default cjxl). zstd-3 paling cepat tetapi rasio jelek (~1.8×). Selubung menambah 153–217 B (konstan), ~0,9–1,0 GiB/s, dan bit-flip terdeteksi.

Sumber mentah: 16-bit LE, 12-bit terpakai. Pano 2900×1400 = 8.120.000 B; periapikal 1500×1000 = 3.000.000 B. 1 pemanasan dibuang, 5 ulangan (p50, min–max). Putar-balik lossless = piksel identik.

| Codec | Peran | Pano B (rasio) | Pano encode p50 (min–max) | Pano decode p50 | Periapikal B (rasio) | Periapikal encode p50 | Periapikal decode p50 | Putar-balik |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| JPEG-XL lossless (`-d 0`) | kandidat asli | 2.396.415 (3.39×) | 459 ms (432–489) | 281 ms | 873.885 (3.43×) | 840 ms (827–874) | 89 ms | ok |
| JPEG 2000 lossless | kandidat asli | 2.471.260 (3.29×) | 776 ms (666–921) | 572 ms | 921.280 (3.26×) | 225 ms (222–276) | 215 ms | ok |
| PNG 16-bit | kandidat asli | 3.351.685 (2.42×) | 1240 ms (1196–1277) | 84 ms | 1.241.871 (2.42×) | 479 ms (461–522) | 36 ms | ok |
| raw + zstd -3 | pembanding, bukan format tampilan | 4.493.070 (1.81×) | 80 ms (77–106) | 19 ms | 1.687.380 (1.78×) | 31 ms (29–32) | 8 ms | ok |
| raw + zstd -19 | pembanding | 3.962.609 (2.05×) | 3567 ms (3350–3669) | 23 ms | 1.513.801 (1.98×) | 928 ms (875–1212) | 10 ms | ok |
| JPEG q70 (penuh, bukan 400 px) | **hanya** preview | 69.181 (117×) | 18 ms | 4 ms | 36.877 (81×) | 8 ms | 3 ms | lossy |
| JPEG-XL distance 1.0 | **hanya** preview | 10.179 (798×) | 653 ms | 129 ms | 6.336 (473×) | 266 ms | 63 ms | lossy |

Selubung AES-256-GCM (compress-then-encrypt, payload = JPEG-XL lossless):

| | Pano | Periapikal |
| --- | ---: | ---: |
| Payload | 2.396.415 B | 873.885 B |
| Envelope | 2.396.632 B | 874.038 B |
| Overhead | 217 B | 153 B |
| Encrypt p50 | 2.7 ms (≈862 MiB/s) | 0.82 ms (≈1022 MiB/s) |
| Decrypt p50 | 2.2 ms (≈1024 MiB/s) | 0.81 ms (≈1032 MiB/s) |
| Bit-flip terdeteksi | ya | ya |

**Keputusan rancangan (berdasarkan angka ini):** asli diagnostik = **JPEG-XL lossless**; thumbnail terpisah = **JPEG q70 ~400 px** (paling murah untuk UI; JXL d=1 lebih kecil tetapi encode lebih mahal). JPEG 2000 tetap diterima sebagai format impor lossless. Jangan zstd-raw sebagai format simpan utama (bukan bitstream viewer).

HTTP prototipe (`POST/GET /api/bench/images`, `php artisan serve`, 5 ulangan setelah 1 pemanasan), pano JXL 2.39 MiB: unggah+selubung p50 **59 ms** (50–63); buka (stream dekripsi, 2.396.415 B, label `SYNTHETIC`, SHA cocok) p50 **30 ms** (29–33, 5 query termasuk audit); buka thumbnail JPEG p50 **21 ms**. `upload_max_filesize` bawaan 2M menolak pano JXL — diukur ulang setelah 32M.

Alat: cjxl/djxl 0.11.2, OpenJPEG 2.5.3, zstd 1.5.7, Pillow 13, NumPy 2.5.4. Log mentah: `tools/bench/out/imaging.json`.


Upload+view HTTP (prototipe `/api/bench/images`, `php artisan serve`) diukur di `BENCHMARK.md` / `tools/bench/out/http.json`.

## 8. Yang belum ada di aplikasi

- Tabel `file_object` / storage adapter, worker transcode, viewer DICOM, KMS, pemotong metadata produksi, retensi/legal hold.
- Endpoint bench **bukan** kontrak API produksi; hanya untuk mengukur dan mendemonstrasikan selubung.
