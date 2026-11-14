# Odontogram Bitto — aset SVG 2D

Bagan gigi datar (bukan 3D, tanpa raster, filter, atau gradien). **Legenda internal**, bukan formulir resmi Kemenkes/PDGI; komponen bisa diganti nanti.

Hasilkan ulang: `python3 generate.py` (dari folder ini). Pratinjau PNG: `preview/`.

Cek skema + kontras WCAG: `python3 check_legend.py` (berjalan pada `legend.json` lawan `legend.schema.json`). Skrip keluar non-nol jika suatu warna di bawah ambang AA pada latar yang dinyatakan, atau jika suatu kondisi tidak punya glif/bentuk.

## Isi folder

| Path | Isi |
|---|---|
| `generate.py` | Skrip pembuat (sumber kebenaran) |
| `odontogram.css` | Kelas yang di-toggle React |
| `odontogram-full.svg` | Bagan lengkap, tata letak standar |
| `teeth/t11.svg` … `t48.svg`, `t51.svg` … `t85.svg` | Satu file per gigi FDI (52 file) |
| `types/{incisor,canine,premolar,molar}-{permanent,primary}.svg` | Kerangka per tipe (premolar hanya gigi tetap) |
| `legend/{sehat,karies,tambalan,mahkota,hilang,sisa_akar,perlu_dicabut,implan}.svg` | Ikon kondisi |
| `legend.svg` | Lembar legenda |
| `legend.json` | Pemetaan kunci → label, warna, glif, applies-to |
| `states/t16-{empty,draft,signed}.svg`, `states/t11-*.svg` | Contoh state molar + insisor |
| `states/examples.svg` | Keenam contoh dalam satu lembar |
| `states/statuses.svg` | Contoh lapisan status tindakan |
| `3d/t11.svg` … `t85.svg` | Bagan grafis 3D lembut, satu file per gigi |
| `3d/odontogram-3d-full.svg` | Bagan 3D lengkap, tata letak FDI yang sama |
| `3d/conditions-row.svg` | Semua kondisi dilukis pada molar dan insisor 3D |
| `preview/odontogram-full.png`, `preview/legend.png`, `preview/states.png`, `preview/statuses.png` | Tangkapan layar 2D |
| `preview/odontogram-3d-full.png`, `preview/odontogram-3d-conditions.png` | Tangkapan layar 3D |

## Skema ID

- Grup gigi: `t16` (nomor FDI, tanpa titik).
- Permukaan: `t16-O`, `t16-M`, `t16-D`, `t16-B`, `t16-L`.
- Gigi anterior (insisor, kaninus) memakai **`I`** di pusat, bukan `O`: `t11-I`.
- Atribut: `data-tooth="16"` `data-surface="O"` pada setiap path permukaan.
- Templat tipe: `type-molar-permanent-O`, dst.

Huruf permukaan (database.md pada D-021: enum `M`, `D`, `O`/`I`, `B`/`L`/`P`):

| Huruf | Arti | Dipakai di |
|---|---|---|
| `M` | Mesial | Semua gigi |
| `D` | Distal | Semua gigi |
| `O` | Oklusal | Premolar dan molar |
| `I` | Insisal | Insisor dan kaninus |
| `B` | Bukal / labial | Semua gigi (labial di anterior) |
| `L` | Lingual (bawah) / palatal (atas) | Semua gigi — **id dan `data-surface` selalu `L`** |

Label *tampak* di bagan: **P** pada gigi rahang atas (palatal), **L** pada gigi rahang bawah (lingual). Huruf P tidak dipakai di id atau `data-surface`, supaya id tetap 5 huruf yang stabil. `surface` boleh `null` di data (seluruh gigi) — itu kondisi whole-tooth, bukan path kelima.

## Aturan cermin (mirroring)

Bagan dari pandangan operator (pasien menghadap dokter): **kanan pasien di kiri bagan**.

- **M selalu menghadap garis tengah.** Kuadran kanan pasien (1, 4, 5, 8 — kiri bagan): M di sisi kanan sel, D di kiri. Kuadran kiri pasien (2, 3, 6, 7 — kanan bagan): M di kiri sel, D di kanan.
- **B di sisi vestibular (luar lengkung).** Rahang atas: B di atas sel, label tampak **P** di bawah (`data-surface` tetap `L`). Rahang bawah: L di atas sel, B di bawah.
- Urutan bagan: atas 18..11 | 21..28, sulung 55..51 | 61..65, sulung 85..81 | 71..75, bawah 48..41 | 31..38. Gigi sulung rata dengan posisi 15–11 dan 21–25 (tidak ada sulung di 16–18 / 26–28).

Lihat sisipan “Orientasi permukaan” di `odontogram-full.svg` (gigi 16 menampilkan P di sisi palatal).

## Legenda (kunci)

Kunci, label, berlaku pada, dan tanda (selalu warna **plus** bentuk):

| Kunci | Label | Berlaku pada | Tanda |
|---|---|---|---|
| `sehat` | Sehat | permukaan | centang hijau |
| `karies` | Karies | permukaan | isi solid + titik |
| `tambalan` | Tambalan | permukaan | isi solid polos |
| `mahkota` | Mahkota | seluruh gigi | cincin di sekeliling gigi |
| `hilang` | Hilang | seluruh gigi | huruf X besar |
| `sisa_akar` | Sisa akar / akar tertinggal | seluruh gigi | garis servikal + V akar |
| `perlu_dicabut` | Perlu dicabut | seluruh gigi | garis miring + panah |
| `implan` | Implan | seluruh gigi | glif sekrup |

Warna di `legend.json` diperiksa `check_legend.py` pada latar putih / token permukaan: glif bersifat teks-ish (kondisi, status, tinta state) ≥ 4,5:1 (WCAG AA teks); grafis non-teks ≥ 3:1. Setiap kondisi wajib punya warna + glif/bentuk. Jangan andalkan warna saja: karies selalu membawa titik (`.surface-dots`).

## Atribut state

Pada grup `.tooth`:

- `data-state="empty"` (atau atribut dihilangkan) — garis solid abu, tanpa aksen.
- `data-state="draft"` — garis putus violet (`#6D28D9`), wash ungu muda, rombus di sudut. Selaras lencana “Draf AI, perlu persetujuan dokter”.
- `data-state="signed"` — garis solid lebih tebal + glif gembok. Entri yang sudah ditandatangani terkunci.

Pada path `.tooth-surface`: `data-condition="karies"` (atau `sehat`, `tambalan`).

Pada grup `.tooth` untuk kondisi seluruh gigi: `data-condition="mahkota"` / `hilang` / `sisa_akar` / `perlu_dicabut` / `implan`. React menambahkan overlay (contoh path ada di `legend/*.svg` dan di `generate.py`).

## Status tindakan dan baseline

*Kemungkinan MVP, menunggu persetujuan Jerome.*

Lapisan **status** terpisah dari kondisi (warna + bentuk di atas). Alur inspirasi Open Dental: ketuk gigi, ketuk permukaan, pilih status, baru pilih kondisi atau tindakan. Status tidak mengganti `data-condition`.

Atribut: `data-status` pada `.tooth-surface` (per permukaan) atau pada grup `.tooth` (seluruh gigi). Kunci di `legend.json` → `statuses`:

| Kunci | Label | Perlakuan visual |
|---|---|---|
| `kondisi` | Kondisi | Titik sudut solid, opasitas penuh |
| `sudah_ada_sini` | Sudah ada (di sini) | Kotak sudut terisi, opasitas penuh |
| `sudah_ada_lain` | Sudah ada (di tempat lain) | Kotak sudut berongga, opasitas 0,7 |
| `direncanakan` | Direncanakan | Segitiga sudut, opasitas 0,5, garis putus |
| `selesai` | Selesai | Centang sudut, opasitas penuh |
| `dirujuk` | Dirujuk | Panah sudut, opasitas 0,8, garis titik |

Status memakai bentuk di sudut + opasitas/gaya garis, bukan warna kondisi. Jika `data-state="draft"` juga aktif, garis putus violet (draf AI) tetap diutamakan; status tetap terlihat dari penanda sudut.

**Baseline gigi** (kunjungan pertama: tandai gigi hilang dan gigi susu/tetap/campuran dulu):

- Pada bagan: `data-dentition="permanent|primary|mixed"` (bagan lengkap memakai `mixed`).
- Pada gigi: `data-dentition="permanent|primary"` (sudah ada) dan `data-baseline="missing"` untuk gigi yang tidak ada sebelum temuan diisi. Kondisi `hilang` tetap temuan klinis; baseline adalah flag kehadiran di peta.

## Bagan grafis 3D lembut (SVG, versi lama)

`3d/*.svg` adalah percobaan pertama (digambar tangan sebagai SVG). **Diganti oleh render Blender di `3d-blender/`** (lihat bagian berikut). File lama tetap dihasilkan untuk perbandingan; jangan dipakai di aplikasi baru.

## Tampilan 3D — render Blender (`3d-blender/`)

**Aturan (review EHR Architect):** render Blender hanya *gambar dasar netral* — gigi sehat per tipe/tampak, plus varian struktural (implan, sisa akar, gigi pudar). Tidak ada gambar per kondisi yang "dibakar". Semua kondisi/status di 3D adalah overlay + mask dari data, diwarnai dari `legend.json`, dengan bentuk glif yang sama dengan 2D. Gigi hilang = slot garis putus + X (overlay), bukan gambar. **Tampilan 3D hanya-baca.**

Gigi 3D lembut dimodelkan prosedural (bidang jarak bertanda + marching cubes, subdivision surface, smooth shading) dan dirender dengan Cycles CPU. **Bagan 2D lima permukaan tetap jadi input per permukaan**; tampilan 3D hanya menampilkan data yang sama (ketuk gigi 3D = pilih gigi).

Hasilkan ulang (dari folder ini), satu perintah:

```bash
blender -b -P blender/teeth.py && python3 blender/compose.py
```

- `blender/teeth.py` — model + render (±25 menit di 8 CPU). Opsi: `-- --only molar-upper,incisor-lower`, `--samples 32`, `--quick`. Butuh `scikit-image` di Python bawaan Blender: `/home/box/opt/blender/4.2/python/bin/python3.11 -m pip install "scikit-image<0.25"`.
- `blender/compose.py` — membuat `legend-vars.css` dari `legend.json`, menyalin `odontogram-3d.css` + `tooth3d.js`, menulis `preview.html` (hanya terang), menambah bbox mask ke `manifest.json`, dan mengambil screenshot `preview/odontogram-3d-blender-*.png` (tanpa varian gelap).
- Prototipe menyalin aset dari `3d-blender/` ke `design/prototype/public/odontogram-3d/` lewat `cd ../prototype && npm run sync-3d` (juga di `predev` / `prebuild`). Jangan salin manual.
- Blender: 4.2 LTS portable di `/home/box/opt/blender`, symlink `~/.local/bin/blender`.

### Model

15 model: tetap atas `incisor`, `canine`, `premolar1` (2 akar, untuk 14/24), `premolar` (1 akar), `molar` (3 akar); tetap bawah `incisor`, `canine`, `premolar`, `molar` (2 akar + batang akar); sulung atas/bawah `p-incisor`, `p-canine`, `p-molar`. Gigi lain memakai model tipe yang sama dengan skala seragam (mis. 12 = insisor × 0,80; 17 = molar × 0,92) — tabel ada di `tooth3d.js` (`POS*`).

### File

| Path | Isi |
|---|---|
| `3d-blender/buccal/<model>@160.webp`, `@320.webp` | Tampak bukal, transparan. Atas: akar ke atas; bawah: akar ke bawah |
| `3d-blender/occlusal/<model>@{160,320}.webp` | Tampak oklusal (tonjol/fisura). Atas: bukal di atas gambar; bawah: bukal di bawah |
| `3d-blender/roots/<model>-{buccal,occlusal}@*.webp` | Sisa akar (mahkota patah) |
| `3d-blender/implant/<model>@*.webp` | Implan: mahkota di atas sekrup titanium (gigi tetap) |
| `3d-blender/ghost/<model>@*.webp` | Gigi pudar (baseline: belum ada / belum erupsi) |
| `3d-blender/masks/<model>-{buccal,occlusal}.webp` | Sprite 7 bingkai: `M, D, O(=I), B, L, crown, root` (alpha = area) |
| `3d-blender/manifest.json` | Ukuran piksel, garis CEJ, lebar mahkota, anchor (titik tengah) dan bbox tiap permukaan |
| `3d-blender/tooth3d.js`, `odontogram-3d.css`, `legend-vars.css` | Spesifikasi komponen (referensi untuk React) |
| `3d-blender/preview.html` | Bagan FDI lengkap + baris kondisi + baris state (`?only=full|conditions|states`). MVP hanya terang; tidak ada varian gelap. |

Ukuran: kepadatan piksel sama untuk semua gigi (`ppm160` = 5,08 px/mm pada set @160), jadi garis CEJ semua gigi sejajar. Set @320 tepat 2×. Bingkai bukal tetap 160 px (sulung 114 px), oklusal 72 px (sulung 58 px).

### Aturan cermin

Semua render menghadapkan **mesial ke kanan gambar**. Kuadran kanan pasien (1, 4, 5, 8; kiri bagan) dipakai apa adanya; kuadran kiri pasien (2, 3, 6, 7; kanan bagan) memakai `transform: scaleX(-1)` pada kotak gambar + mask. Glif overlay **tidak** dicerminkan (supaya tetap terbaca); posisi anchor-nya saja yang dibalik (`x → 1 − x`).

### Overlay (kondisi tidak dibakar ke render)

Satu rekaman data per gigi — sama dengan bagan 2D — menggerakkan kedua tampilan:

```js
{ tooth: 16, state: "signed",
  layers: [ { condition: "tambalan", surfaces: ["O","M"], status: "sudah_ada_sini" },
            { condition: "mahkota", status: "direncanakan" } ] }   // tanpa surfaces = seluruh gigi
```

- Grup `.t3` membawa `data-tooth`, `data-state`, `data-condition` / `data-status` (kondisi seluruh gigi), `data-baseline`. Tiap lapisan `.t3-layer` membawa `data-condition`, `data-status`, `data-surface` — atribut yang sama dengan path `.tooth-surface` di 2D.
- **Pewarnaan permukaan**: `div` dengan `mask-image` (sprite mask) + `background: var(--cc)` + `mix-blend-mode: multiply`, jadi bayangan render tetap terlihat. Karies selalu bertitik; direncanakan selalu berarsir.
- **Glif** (SVG di atas render, dari bentuk legenda): titik karies, kotak tambalan, cincin/tudung mahkota, X hilang + slot putus-putus, V sisa akar, garis miring + panah perlu dicabut, sekrup implan; penanda status di sudut. Draf AI: bingkai putus violet + rombus amber. Terkunci: bingkai solid + gembok.
- **Berlapis**: beberapa lapisan per gigi; opasitas per status dari `statuses.items[].fill-opacity`. `hilang` menyembunyikan semua lapisan lain; `sisa_akar` dan `implan` mengganti gambar dasar. Slot supernumerari opsional (`data-tooth="S12"`, setengah ukuran).
- **Warna hanya dari `legend.json`**: `compose.py` menulis `legend-vars.css` (`--c-<kondisi>`, `--s-<status>`, `--state-*`). Ganti palet = ubah `legend.json` lalu jalankan ulang `compose.py`. Bentuk glif tetap.

## Contoh pemakaian React

SVG inline (disarankan — id tetap bisa di-query, `currentColor` mengikuti CSS):

```tsx
import { useId } from "react";

type Surface = "M" | "D" | "O" | "I" | "B" | "L";

export function ToothCell({
  fdi,
  state = "empty",
  surfaces = {},
  whole,
  onSurfaceClick,
}: {
  fdi: number;
  state?: "empty" | "draft" | "signed";
  surfaces?: Partial<Record<Surface, "sehat" | "karies" | "tambalan">>;
  whole?: "mahkota" | "hilang" | "sisa_akar" | "perlu_dicabut" | "implan";
  onSurfaceClick?: (fdi: number, surface: Surface) => void;
}) {
  // Impor isi teeth/t{fdi}.svg sebagai komponen, atau tempel inline.
  // Contoh handler:
  const handle = (el: SVGPathElement) => {
    const surface = el.dataset.surface as Surface | undefined;
    if (surface) onSurfaceClick?.(fdi, surface);
  };
  return (
    <svg viewBox="0 0 100 122" className="tooth-svg" color="currentColor">
      {/* grup #t{fdi} dari file, dengan data-state dan data-condition */}
    </svg>
  );
}

// Atau <use>:
// <svg viewBox="0 0 100 122">
//   <use href="/odontogram/teeth/t16.svg#t16" />
// </svg>
```

Kelas CSS ada di `odontogram.css` (juga tertanam di setiap SVG supaya file mandiri tetap terlihat benar).

Ketuk path `.tooth-surface` untuk set kondisi per permukaan. Bandingkan kunjungan dengan menumpuk dua bagan dan menandai path yang `data-condition`-nya berbeda.
