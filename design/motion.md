# Gerak Bittodent

Web terasa kasar dan patah-patah karena hampir tidak ada gerak. Di `origin/main` (`f36fa9e`) dan di frontend yang lebih lengkap (`origin/staging/integration`, `873279e`) tidak ada `transition`, `@keyframes`, atau `prefers-reduced-motion` di CSS, dan tidak ada pustaka gerak. Ganti state menukar node sekaligus.

Ukur di app lokal (Vite `127.0.0.1:5173`, 15 Nov 2026 WIB). Satu pergeseran tata letak: kartu login membesar setelah daftar "Masuk cepat" tiba.

| Lebar | CLS | Ambang baik | Sumber |
| --- | --- | --- | --- |
| 360 | 0.209 | ≤ 0.1 | `.login-card` y 182→11, tinggi 437→780 |
| 1280 | 0.041 | ≤ 0.1 | pergeseran yang sama, dampak lebih kecil di viewport lebar |

Bukti: `/workspace/audit/motion/cls.json`, `cls-360.png`, `cls-1280.png`.

Token ini nanti masuk `design/tokens.json` (jangan sunting `tokens.css` dengan tangan). Merek tetap `#0B6B62`.

## Token

| Token | Nilai | Pakai untuk |
| --- | --- | --- |
| `--motion-fast` | 120ms | tekan tombol, hover, fokus, ganti chip |
| `--motion-std` | 200ms | halaman, popover, tab, accordion, daftar, toast, dock |
| `--motion-slow` | 280ms | masuk sheet atau drawer. Tidak boleh lebih dari 300ms di alur dokter |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | hover, tab, chip, default |
| `--motion-ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | elemen masuk |
| `--motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | elemen keluar, lebih cepat terasa (tetap pakai `--motion-fast` atau `--motion-std`) |
| `--motion-ease-spring` | `cubic-bezier(0.32, 0.72, 0, 1)` | masuk sheet. Tanpa pegas yang memantul melebihi 300ms |
| `--motion-distance-page` | 8px | geser halaman |

Keluar memakai durasi yang sama atau lebih singkat daripada masuk, bukan lebih lama.

## Aturan

1. Animasikan hanya `transform` dan `opacity`. Accordion dan item daftar boleh menganimasikan `grid-template-rows` dari `0fr` ke `1fr` karena tinggi otomatis tidak bisa memakai transform saja.
2. `@media (prefers-reduced-motion: reduce)`: matikan geser dan skala. Fade singkat (maksimal `--motion-fast`) atau ganti state tanpa gerak.
3. Di alur kerja dokter (catat, setujui, pindah halaman, buka sheet gigi) tidak ada animasi lebih dari 300ms.
4. Jangan memblokir input. Tombol tetap bisa diketuk saat animasi berjalan. Jangan `pointer-events: none` pada seluruh layar hanya untuk menunggu transisi.
5. Cadangkan ukuran untuk skeleton, daftar, dan blok yang muncul belakangan agar tidak menggeser tata letak.
6. Satu aksi utama per layar tetap berlaku. Gerak tidak menambah tombol primer.

## Pola

| Pola | Gerak | Cara | Titik app sekarang |
| --- | --- | --- | --- |
| Tombol tekan | `scale(0.97)` selama `--motion-fast` | `:active`. Hover warna `--motion-fast` + `--motion-ease-standard`. `:focus-visible` cincin 2px `#0B6B62`, tanpa skala | `.btn` di `shared/ui/styles.css`. Hover sudah ganti warna, tanpa transisi, tanpa `:active` |
| Hover dan fokus | warna atau bayangan, bukan geser isi | transisi warna `--motion-fast` | sama |
| Sheet atau drawer HP | masuk: `translateY(100%)` → `0` + backdrop opacity, `--motion-slow` + `--motion-ease-spring`. Keluar: `--motion-std` + `--motion-ease-exit`. Pegangan tampil, geser-tutup menyusul jika perlu JS | pasang kelas `is-open` / `is-leave`. Jangan unmount di frame pertama | `Shell.tsx` menu Lainnya (`.sheet`, `.sheet-backdrop`). `Chart.tsx` `.tooth-sheet`. Keduanya muncul dan hilang instan |
| Dialog desktop | backdrop fade, dialog `translateY(8px)` + opacity, `--motion-std` + `--motion-ease-enter` | sama | `.overlay` + `.dialog` di `Schedule.tsx`, `SelesaiDialog.tsx` (staging), `SignDialog.tsx` (main) |
| Popover | opacity + `translateY(4px)`, `--motion-fast` | `Menu.tsx` `.menu-pop` | muncul instan |
| Accordion atau fold | `grid-template-rows: 0fr` → `1fr`, `--motion-std` + `--motion-ease-standard`. Isi `overflow: hidden` | checkbox atau state terkontrol, bukan `display: none` di frame pertama | belum ada fold di app. Papan KlinikMe memakai `<details>` tanpa gerak |
| Indikator tab | `transform: translateX(...)` pada satu indikator, `--motion-std` | ukur lebar dan posisi tab aktif | `Records.tsx` ganti tab lewat tautan yang meremount halaman |
| Pindah halaman | konten lama opacity 0, konten baru opacity 1 + `translateY(8px)` → `0`, `--motion-std`. Tanpa layar kosong "Memuat…" yang mengganti seluruh shell | jaga `Shell` tetap terpasang. Skeleton di area konten, bukan `return <div>Memuat…</div>` di akar | `App.tsx` `useHash`, `key={hash}` meremount. `state === 'loading'` menukar seluruh pohon ke "Memuat…" |
| Skeleton | placeholder tetap (tinggi cadangan), kilau `translateX` pada overlay, loop maksimal `--motion-slow` per lintasan | jangan ganti "Memuat…" yang meruntuhkan tinggi | `App.tsx`, `Home.tsx`, `Schedule.tsx`, `Records.tsx`, `Patients.tsx`, `InvoicePage.tsx` semua `if (!data) return "Memuat…"`. `.is-loading { opacity: 0.6 }` instan |
| Toast | masuk dari bawah `translateY(8px)` + opacity, `--motion-std`. Tinggal, lalu keluar `--motion-fast`. Jangan dorong tata letak (posisi tetap) | portal, `aria-live="polite"` | belum ada toast. `ManagePage` menaruh teks `notice` di alur dokumen |
| Chip status | silang fade opacity `--motion-fast` (dua lapisan atau ganti warna) | Draf / Disetujui / Ditolak, plus status janji | kelas `.appt-*` dan chip ganti instan |
| Item daftar disetujui atau ditolak | setelah aksi, shrink `grid-template-rows` `--motion-std`, opacity turun | jangan hapus node di frame yang sama dengan klik | belum ada |
| Dock aksi menempel | `translateY(8px)` + opacity saat muncul, `--motion-std`. Dock sudah cadangkan tinggi | pasang di alur flex, bukan `position: fixed` yang menutup konten | belum ada di app. Pola ada di papan KlinikMe |

Demo CSS saja: `design/boards/motion.html`.

## Pustaka

| Pilihan | Ukuran | Keputusan |
| --- | --- | --- |
| CSS variables + kelas di `tokens.css` / `styles.css` | 0 kB | Pakai ini dulu. Cukup untuk semua pola di atas kecuali geser-tutup sheet |
| `motion` (Motion untuk React, dulu Framer Motion) | sekitar 30 kB minified, 10-15 kB gzip per import tipikal | Tambah nanti hanya jika geser-tutup sheet atau layout daftar tidak tertangani CSS. Jangan pasang sekarang |

Jangan pasang pustaka animasi lain. App saat ini hanya `react` dan `react-dom` (staging menambah font).

## Tugas Builder, urutan

1. Masukkan token gerak ke `design/tokens.json` dan generate CSS. Tambah `@media (prefers-reduced-motion: reduce)`.
2. Tombol: transisi hover, `:active { transform: scale(0.97) }`, fokus tetap cincin, jangan blokir ketukan.
3. Ganti "Memuat…" di akar halaman dengan skeleton yang cadangkan tinggi. Perbaiki login: cadangkan ruang "Masuk cepat" atau tampilkan kerangka yang sama agar CLS 360 turun di bawah 0.1.
4. Pindah hash: `Shell` tetap ada, isi area utama fade+geser 8px, tanpa flash kosong. Pertimbangkan tidak meremount lewat `key={hash}` jika state bisa dipertahankan.
5. Sheet HP (Lainnya, detail gigi) dan dialog desktop: masuk/keluar sesuai token. Pegangan sheet tampil. Geser-tutup boleh menyusul.
6. Popover menu, indikator tab jika tab visual ditambah, chip status silang fade.
7. Toast portal untuk umpan balik singkat, tidak menggeser layout.
8. Item yang disetujui atau ditolak: collapse halus. Dock aksi: gerak masuk singkat, tinggi sudah dicadangkan.

Kerjakan 1-5 dulu. Itu sumber rasa patah yang paling terasa di alur dokter.
