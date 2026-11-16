# Jejak keputusan migrasi HeroUI

Cabang `feat/heroui-migrasi`, PR https://github.com/simbosimbo/Bittodent/pull/64.

| Waktu (WIB, 2026-11-16) | Keputusan / hasil | Bukti |
| --- | --- | --- |
| 17.33 | Migrasi semua layar ke HeroUI v3 + Pro (pilihan pemilik produk), Pro dari folder lokal. | Percakapan sesi |
| 17.35 | CSS lama dibagi: `legacy-base` (elemen polos) di bawah HeroUI, `legacy` (kelas) di atas HeroUI. `--radius` lama → `--radius-card`. | commit fondasi PR #64 |
| 17.45 | Gerbang 1: `scripts/legacy-classes.mjs`. Baseline 231 pemakaian kelas bentrok (scheduling 47, clinical 43, billing 39, patients 35, shared/ui 28, reporting 23, settings 13). | keluaran skrip |
| 17.46 | Gerbang 2: `scripts/ui-audit.mjs`. Dua cacat alat ditemukan dan diperbaiki: SPA tetap di halaman login setelah login cepat (perlu reload), dan `innerWidth` ikut melebar di emulasi HP (bandingkan dengan lebar target). Ditambah cek kontrol di luar layar. | probe 390 dokter `/`: overflow 510, 5 kontrol di luar layar |
| 17.48 | Baseline audit (sambil subagen shell bekerja, jadi acuan kasar): 44/44 halaman gagal. Penyebab utama overflow/kontrol di luar layar dari tabrakan `.menu` di top bar (17 HP, 22 desktop). Target sentuh kecil hanya di `/pasien` HP: tautan nama pasien tinggi 23px. 36 kombinasi peran×rute dialihkan ke `/` (izin atau tanpa pasien aktif); RM perlu rute pasien eksplisit. | `screenshots/ui-audit/baseline/report.json` (lokal) |
| 17.53 | Rujukan Pro dari pemilik (Agent Skills `heroui-react-pro` + `heroui-pro-design-taste`, dokumentasi HTML per komponen, 4 template) dimasukkan ke kontrak sebagai bacaan saja. Template dashboard (`AppLayout` + sidebar + navbar) jadi acuan shell. Kanvas tetap menang atas selera desain HeroUI bila bertentangan (mis. label kapital di kanvas). | `docs/ui/migrasi-heroui.md` |
