# Kontrak migrasi HeroUI (untuk subagen modul)

Dokumen ini kontrak kerja. Jangan diubah oleh subagen; laporkan bila ada yang salah.

## Tujuan

Seluruh React SPA (`app/frontend`) memakai komponen HeroUI v3 + HeroUI Pro dengan tema token Bittodent, supaya tampilan HP dan desktop seragam, seimbang, dan ukuran fontnya sesuai kanvas desain "Bittodent / Kasir". Kelas CSS lama yang bentrok dengan HeroUI hilang.

## Sudah tersedia (jangan diulang)

- `@heroui/react` + `@heroui/styles` 3.2.7, `@heroui-pro/react` (pasang lokal), Tailwind v4.
- `src/shared/ui/app.css` satu-satunya entry CSS. Layer: `theme, base, legacy-base, components, legacy, utilities`. Tema HeroUI → token Bittodent (accent `#0B6B62`, Plus Jakarta Sans, `--radius: 8px`).
- Shell (top bar, bottom nav, `shared/ui`) sudah dimigrasi lebih dulu. Pakai API `shared/ui` apa adanya.
- Dokumen HeroUI v3: `node /Users/yohanessantoso/.claude/skills/heroui-react/scripts/get_component_docs.mjs <Komponen...>`. Komponen Pro: `app/frontend/node_modules/@heroui-pro/react/dist/components/<nama>/index.d.ts`.
- Pola v3: tanpa Provider, compound (`Card.Header`), `onPress` bukan `onClick`, varian semantik (`primary`, `secondary`, `tertiary`, `danger`, `ghost`, `outline`). Jangan pakai pola v2.

## Rujukan HeroUI Pro (baca saja, berlisensi: jangan salin file ke repo)

- Skill Pro: `/Users/yohanessantoso/Downloads/Hero UI/Agent Skills/HeroUI Web/.claude/skills/heroui-react-pro/SKILL.md` (aturan import, komponen yang TIDAK ada: `Divider` → `Separator`, `Progress` → `ProgressBar`, tanpa `CardHeader` langsung).
- Selera desain: `.../heroui-pro-design-taste/SKILL.md` di folder yang sama. Dipakai bila kanvas tidak mengatur; kanvas menang bila bertentangan.
- Halaman dokumentasi offline per komponen Pro: `/Users/yohanessantoso/Downloads/Hero UI/Components/<Kategori>/<Nama>.html` (mis. `Navigation/Navbar.html`, `Overlays/Sheet.html`, `Data Display/List View.html`, `Data Display/Agenda.html`, `Data Display/KPI.html`, `Forms/Native Select.html`).
- Contoh aplikasi: template dashboard terekstrak di scratchpad koordinator `/private/tmp/claude-501/-Users-yohanessantoso--claude-spares-spare-NRLtSP/a105626c-cd19-4571-bded-9e4cb20d490b/scratchpad/heroui-ref/template-dashboard/src` (`components/app-shell.tsx` pakai `AppLayout`, `widgets/*` untuk kartu, tabel, KPI). Next.js; ambil polanya, bukan routing-nya.
- Ikon: tetap pakai `shared/ui/Icon` milik SPA (jangan tambah `@iconify/react`).

## Pagar (wajib)

- Tulis HANYA file di folder modulmu (`src/modules/<modul>/**`, termasuk CSS dan tesnya). File lain milik orang lain: `src/shared/**`, `src/App.tsx`, `app.css`, `styles.css`, `package.json`, `vite.config.ts`, modul lain, backend, dokumen ini.
- Butuh perubahan di luar pagar → jangan diubah; tulis di laporan sebagai permintaan.
- Jangan commit, jangan ganti cabang, jangan pasang paket baru. Butuh peer Pro (mis. `motion`) → minta di laporan.
- Data sintetis saja. Bahasa Indonesia sederhana. Jangan klaim sertifikasi/kepatuhan di UI.
- Logika bisnis, panggilan API, aturan klinis (draf vs tanda tangan, tenant), dan alur tidak berubah. Ini migrasi tampilan.
- Tes: pertahankan perilaku yang diuji (teks, peran ARIA, alur, aturan). Ganti selector kelas lama ke peran/teks. Jangan hapus cakupan aksesibilitas.

## Resep per layar

1. Baca artboard kanvas yang relevan (lihat tabel). Kanvas: `https://claude.ai/code/artifact/54a947b7-e8a8-4dfe-b709-99c55b916ef7`, baca dengan Artifact `read_file` path `project/<nama>.dc.html`. Kanvas = sumber tata letak dan ukuran; warna dari token.
2. Ganti markup lama ke komponen HeroUI/Pro. Kelas bentrok yang harus hilang: `avatar, badge, card, chip, menu, tabs, toast, toolbar, spinner, date-field, field-error`.
3. Hapus CSS modul yang tidak terpakai lagi. Tata letak sisa: utilitas Tailwind atau CSS modul berawalan nama modul.

## Ukuran target

- HP (≤720px): body 15px, sekunder 14px, caption 13px, minimal 12px. Judul halaman 20–22px/700. Gutter 16px, gap 12px. Kartu radius 16px, padding 12–16px. Target sentuh ≥44px (aksi primer ≥48px). Tanpa overflow horizontal. Meta kartu tidak terpotong oleh tombol (tombol turun ke baris sendiri bila sempit).
- Desktop: tata letak sekarang dipertahankan, hanya komponennya diganti.

## Tombol HP: seimbang, tidak besar, tetap mudah dipencet

Patokan: target sentuh Apple HIG 44pt dan Material 48dp. Target sentuh boleh lebih besar dari bentuk yang terlihat.

- **Satu aksi utama per layar atau per kartu.** Hanya aksi itu yang solid (`variant="primary"`). Aksi lain `secondary`, `outline`, atau `ghost`.
- **Tombol di dalam baris/kartu:** tinggi 44px, teks 14px/600, padding samping 12px, lebar mengikuti isi (jangan `fullWidth`). Label pendek 1–2 kata ("Mulai", "Buka RM", "Bayar"); konteks sudah ada di kartu. Ikon hanya bila menambah arti.
- **Seluruh baris/kartu = satu target** bila aksinya "buka detail". Tanpa tombol terpisah; pakai chevron kecil di kanan.
- **Tombol utama halaman/form:** tinggi 48px, teks 15px/600, lebar penuh, menempel di bawah (sticky) di atas bottom nav bila form panjang.
- **Tombol ikon:** 44×44 dengan ikon 20px dan `aria-label`.
- **Kartu sempit:** tombol tidak boleh memotong meta. Bila nama/meta + tombol tidak muat, tombol turun ke baris sendiri di bawah meta, rata kanan.

## Gaya ringkas HP (referensi pemilik 2026-11-16, menggantikan #70)

Referensi gaya Zendenta: ambil prinsipnya saja, jangan salin tata letak atau warnanya.

- Skala huruf HP: body 14, sekunder 13, caption 12, judul halaman 20. Input tetap 16px (iOS).
- **Kartu daftar tanpa tombol.** Seluruh kartu = satu target; ketuk → `Sheet` detail berisi info lengkap + aksi. Aksi utama satu tombol lebar penuh di bawah sheet (48px); aksi lain di bawahnya `outline`/`ghost` atau menu "⋯". Ini mengganti #70: "Mulai kunjungan" dokter jadi 2 ketuk (kartu → sheet → Mulai kunjungan).
- **Isi kartu:** baris 1 nama (14/600) + status di kanan atas; baris 2 rentang jam "10.40 › 11.00" dan/atau meta (13, muted). Tanpa avatar bila tidak menambah arti.
- **Status = titik + teks** (12–13px, warna teks netral, titik berwarna status), latar netral lembut, tanpa bingkai tebal. Bukan chip berbingkai berwarna penuh.
- Garis/bingkai tipis (`--border`), latar kartu putih di atas latar abu muda, ruang kosong lega (padding kartu 12–16, jarak antarkartu 8–12).
- Info keselamatan tetap terlihat di kartu bila relevan (alergi/peringatan, sisa tagihan).

## Tipografi dan alur informasi kartu

Hanya 4 berat huruf, masing-masing satu peran. Kalau semuanya tebal, tidak ada yang menonjol.

| Berat | Dipakai untuk |
| --- | --- |
| 700 | judul halaman, angka utama (KPI, total tagihan) |
| 600 | nama di kartu, judul seksi, label tombol, nama di sheet |
| 500 | label field, teks status, tab/chip terpilih |
| 400 | isi, meta, keterangan, nilai di sheet detail |

Dilarang 550, 650, 750, 800. Meta tidak pernah tebal; bedakan dengan warna `--muted`, bukan berat.

**Alur kartu daftar (atas → bawah, maks 3 baris):**
1. **Siapa** nama (14/600) · status titik di kanan.
2. **Apa** tindakan atau keluhan (13/400, warna teks biasa).
3. **Kapan/di mana** "10.40 › 11.00 · Kursi 1 · drg. Andi" (13/400 muted, `tabular-nums` untuk jam).
Angka uang di kanan baris 1 (14/600, `tabular-nums`). Info keselamatan (alergi/peringatan) sebagai baris tambahan berwarna, bukan disembunyikan.

**Sheet detail:** judul = nama (18/600) + status; lalu pasangan label–nilai (label 12/500 muted di atas, nilai 14/400), urut: waktu, tindakan/keluhan, kursi, dokter, catatan; aksi di bawah.

## Radius (jangan terlalu bulat)

Skala rumah di `app.css`: field 10px, tombol 12px, kartu/popover/modal 16px, chip 12px. Jangan menambah `rounded-full`, `rounded-3xl`, atau radius di atas 16px, kecuali tombol ikon bulat yang memang bulat di kanvas (tombol "+", avatar). Jangan menimpa radius per komponen; ubah skala di `app.css` (milik koordinator) bila perlu.

## Progressive disclosure di HP

- Paling banyak 1 aksi utama + 1 aksi sekunder terlihat per kartu. Sisanya masuk menu "⋯" (`Menu` dari shared/ui) atau sheet aksi (`Sheet`).
- Detail sekunder (riwayat, catatan panjang, rincian tagihan) dilipat di balik "Lihat detail" / disclosure, jangan dibentangkan semua.
- Saringan banyak: tampilkan 2–3 chip yang paling sering dipakai, sisanya di sheet "Saring".
- Informasi keselamatan (alergi, peringatan medis, status tanda tangan, sisa tagihan) **tidak boleh** disembunyikan di balik disclosure.

## Artboard per modul

| Modul | Artboard |
| --- | --- |
| scheduling | PD01, QA1–QA4, JH01–JH10, FO01, FO07–FO13, MP02 |
| clinical | PD02–PD07, PD10–PD15, OD06–OD08, OVv2-01–07, AL01–AL09, PR07–PR13, IC08–IC18, EA08, RK06–RK19 |
| patients | PD08, FO02–FO06, AIv4-04 |
| settings | PR02–PR06, MP03–MP05, KL10–KL13, AP04–AP09, IC19–IC28 |
| billing | KL01–KL06, K01–K15, RK20–RK23, PR14 |
| reporting | KL07–KL09, RK25 |
| booking | SS01–SS18 |
| auth | DS-Components (form, tombol) |

## Selesai bila (diperiksa ulang oleh koordinator, bukan laporanmu)

1. `npx tsc --noEmit` bersih.
2. `npx vitest run src/modules/<modul>` lulus.
3. `node scripts/legacy-classes.mjs --json` → tidak ada hit di folder modulmu.
4. `node scripts/ui-audit.mjs --routes <rute modulmu> --out <scratchpad>` → semua `ok` (tanpa overflow, tanpa kontrol di luar layar, target ≥44px di HP, tanpa teks <12px). Login sintetis otomatis.
5. Screenshot 390px dan 1440px rute modulmu dibandingkan dengan artboard; sebut perbedaan yang tersisa.

## Laporan (ringkas)

File diubah, komponen HeroUI/Pro dipakai, hasil 4 pemeriksaan di atas (angka), perbedaan dari kanvas yang tersisa, permintaan di luar pagar.
