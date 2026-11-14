# Arah cangkang Bitto (hanya Jadwal)

Tiga arah gaya untuk aplikasi klinis yang padat tetapi tetap tenang: hirarki jelas, kebisingan visual rendah, ramah sesi panjang, tablet (1024×768) dan desktop (1440). Masing-masing diterapkan **hanya** pada halaman Jadwal dengan data palsu, lewat `#/jadwal?shell=a|b|c`. Cangkang default di layar lain tidak berubah.

Pola dipelajari dari Mobbin (web) dan referensi publik, lalu **diadaptasi** — bukan disalin. Tidak ada aset, salinan teks, atau tata letak piksel-sempurna dari Zendenta, CareStack, Linear, Notion, atau layar Mobbin. Wordmark dan ikon Bitto milik sendiri. Warna legenda odontogram tetap dari `legend.json` / token; token per arah ada di `design/tokens.json` → `shells.a|b|c`.

Pintu keselamatan tetap: alergi + chip Peringatan selalu terlihat, NIK/HP tersamar, banner Mode offline tanpa data pasien, target sentuh ≥44px di tablet (A & C juga di desktop; B desktop lebih rapat, tablet naik ke 44px).

Cuplikan: `design/screenshots/shell-{A,B,C}-jadwal-{desktop,tablet}.png`.

## Metode

- Mobbin MCP `search_screens` (platform web), 14 November 2026, kueri: kalender staf / kolom sumber daya, dasbor admin + palet perintah, rekam pasien + panel detail.
- Referensi publik: studi kasus Zendenta, Linear, Notion, dan catatan riset Bitto yang sudah ada (`mobbin-patterns.md`, Open Dental).
- Yang dipinjam: *struktur* (sidebar, kartu, palet, pita konteks, pecahan kisi+detail). Yang tidak dipinjam: warna merek, tipografi, ikon, atau salinan UI mereka.

---

## A — Seperti Zendenta

**Struktur.** Sidebar penuh tinggi: logo Bitto, pengalih cabang + alamat contoh, navigasi berkelompok (Klinik / Keuangan), bantuan di bawah. Kolom utama: judul halaman + cari + lonceng + pengguna, pita keselamatan pasien, lalu kartu putih (kalender + papan tunggu) di latar abu-teal lembut. Bayangan kartu sangat ringan.

**Desktop.** Sidebar 248px, judul 24px, target 44px, jarak halaman 24px.

**Tablet (1024).** Sidebar merosot ke rel ikon 72px agar kolom kursi tetap kebaca; kartu dan pita pasien tetap.

### Kelebihan untuk klinik

- Pola PMS yang sudah familiar (cabang di kiri, judul + cari di atas, isi di kartu) — pelatihan resepsionis lebih singkat.
- Kartu putih di latar berwarna memisahkan jadwal dari cangkang; sesi 8 jam lebih tenang daripada kanvas putih datar.
- Ada ruang untuk nama cabang, alamat, dan bantuan di sidebar desktop; di tablet modul tetap ada sebagai ikon.

### Kekurangan untuk klinik

- Sidebar 248px memakan lebar kolom kursi ketika 3+ kursi dibuka di 1024.
- Judul besar + cari + lonceng + kartu menambah gulir vertikal di tinggi 768.
- Jika bayangan dan “Chrome SaaS” terlalu ramai, bisa terasa admin, bukan klinis.

### Referensi (pola, bukan salinan)

- Studi kasus Zendenta (cangkang aplikasi: sidebar, judul di kolom utama, kalender di kanvas terang): [fikristudio.com/project/zendenta](https://fikristudio.com/project/zendenta)
- Canva Content Planner (sidebar berkelompok, judul halaman + aksi, kalender di kanvas terang): [Mobbin — Canva](https://mobbin.com/screens/be2ea45c-7584-425a-b665-c6cb9d1ce889)
- incident.io Schedules (sidebar berkelompok, isi putih, kisi sumber daya): [Mobbin — incident.io](https://mobbin.com/screens/c14089d9-ccea-46c7-a13e-4aae572ea7ce)
- Fresha (kolom staf, garis “sekarang”, alat di atas) — untuk kepadatan kalender, bukan cangkang penuh: [Mobbin — Fresha](https://mobbin.com/screens/a531e5be-cb29-4688-bfec-eb8db07008f4)

---

## B — Rapat-tenang (Linear / Notion)

**Struktur.** Sidebar netral ramping, pengguna di kaki, baris rapat, **batas 1px tanpa bayangan**, satu aksen (teal Bitto). Bilah atas didominasi pemicu “Cari pasien, janji, atau perintah…” dengan petunjuk **Ctrl+K**. Palet perintah mencari pasien, modul, dan sakelar Mode sederhana / offline. Pita alergi tetap di bawah bilah, lebih padat.

**Desktop.** Sidebar 200px, tipe 13px, judul 18px, target 36px, jarak ketat.

**Tablet.** Sidebar ikon 56px; target naik ke 44px agar memenuhi gerbang sentuh. Palet tetap bisa dibuka dari kotak cari (sentuhan), bukan hanya papan tombol.

### Kelebihan untuk klinik

- Kepadatan informasi tertinggi: lebih banyak jam dalam viewport, lebih sedikit krom yang mengganggu fokus hari.
- Satu aksen + tanpa bayangan menenangkan untuk shift panjang di resepsi atau ruang dokter.
- Ctrl+K mempercepat lompat pasien/modul tanpa meninggalkan jadwal — berguna di desktop admin.

### Kekurangan untuk klinik

- Kerapatan 13px/36px di desktop kurang ramah jari; tanpa bump tablet, target bisa gagal 44px (prototipe ini sudah menaikkan target di ≤1100px).
- Palet perintah berpihak pada papan tombol; staf yang bekerja sentuhan mungkin mengabaikan Ctrl+K.
- Tampilan “alat startup” bisa terasa kurang klinis bagi pemilik yang ingin kesan medis.

### Referensi (pola, bukan salinan)

- [Linear](https://linear.app) — kepadatan, satu aksen, palet perintah.
- [Notion](https://www.notion.so) — sidebar netral, pengguna di bawah, batas halus.
- n8n (rel ikon + palet perintah): [Mobbin — n8n](https://mobbin.com/screens/28338d7a-25d5-4fd0-8357-9a770b30ac00)
- incident.io (palet perintah di atas dasbor): [Mobbin — incident.io](https://mobbin.com/screens/907900ee-1dca-4726-ae50-9e043eecfbe4)
- Luma (cari + aksi cepat): [Mobbin — Luma](https://mobbin.com/screens/a2868ad5-6a82-4c3a-9a1c-c1dd091d1018)
- Searchable (bilah cari atas + sidebar ramping): [Mobbin — Searchable](https://mobbin.com/screens/e2cb28e0-b07c-4dd3-a9d3-74f72061fce4)
- Mindtrip (kalender minggu padat, sidebar ramping): [Mobbin — Mindtrip](https://mobbin.com/screens/4f8af2f1-e584-46e1-ac7c-700be750581c)

---

## C — Dasbor klinis / EHR modern

**Struktur.** Rel ikon teal gelap (target 48px). Bilah atas kompak: judul, cabang, pasien aktif, mode, pengguna. **Pita konteks pasien** penuh lebar (nama, RM, usia, alergi, peringatan, NIK/HP tersamar) dengan tepi aksen. Isi terpecah: jadwal di kiri, **panel detail kanan** untuk janji yang dipilih — tanpa modal yang menutupi kisi. Default panel: janji pasien aktif (Siti, data palsu).

**Desktop.** Rel 72px, panel 360px, tipe 15px, target 48px.

**Tablet.** Panel menyempit ke 300px; papan tunggu menumpuk di bawah kisi agar panel tetap terlihat. Di lebar <900px panel pindah ke bawah (tidak dipakai pada cuplikan 1024).

### Kelebihan untuk klinik

- Alergi dan peringatan berada di garis pandang yang sama dengan jadwal — gerbang keselamatan lebih sulit terlewat.
- Membuka janji tidak menutupi kisi; koordinasi antar-kursi tetap terlihat.
- Target 48px dan panel tetap cocok untuk tablet di sisi kursi.

### Kekurangan untuk klinik

- Panel memakan lebar: 3 kursi + papan tunggu + detail terasa sesak di 1024.
- Pita pasien aktif bisa “salah fokus” saat resepsi mengatur banyak orang, bukan satu pasien.
- Dua konteks (pasien aktif vs pasien di janji yang diketuk) perlu disadari — panel dan pita bisa menunjuk orang berbeda.

### Referensi (pola, bukan salinan)

- Stripe (kepala identitas + kolom detail kanan): [Mobbin — Stripe](https://mobbin.com/screens/d0203ce6-56d8-4a16-b4b6-08cbf7eb4c68)
- Attio (daftar + panel kanan): [Mobbin — Attio](https://mobbin.com/screens/5fc7fb8b-bc6c-4c92-bfd9-e9f2ce4dd812)
- Unify (pecahan daftar + detail orang): [Mobbin — Unify](https://mobbin.com/screens/e767e613-3036-4a56-95e2-51e091162f73)
- Gumloop (panel detail kanan): [Mobbin — Gumloop](https://mobbin.com/screens/9e26963f-4fec-414c-bcea-cf8c993b2959)
- AirOps (daftar + panel kanan): [Mobbin — AirOps](https://mobbin.com/screens/f0732501-47e5-4c2d-8253-83b9876c1f9b)
- Pola pasien-sentris Open Dental (sudah di riset Bitto, `docs/research/opendental-chart-ux.md`) — pita konteks, bukan salinan UI.

---

## Yang tidak dikerjakan di putaran ini

Kemudahan charting “seperti CareStack tapi lebih nyaman” ditunda sampai arah cangkang dipilih. Palet kondisi gigi masih mengikuti `legend.json`; sapuan penuh warna hardcode di CSS charting belum selesai.
