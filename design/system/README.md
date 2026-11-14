# Design system Bittodent

Sumber token: `design/tokens.json`. CSS di-generate oleh `app/frontend/scripts/gen-tokens.mjs` ke `design/tokens.css` dan `app/frontend/src/shared/ui/tokens.css`. Jangan menambah palet kedua.

Brand / action adalah primary-700 `#0B6B62`. Hover `#0A5650`. Primary-500 `#14A396` hanya di skala, tidak untuk tombol, chrome, atau focus ring.

Pola visual (canvas, netral, radius, sidebar, bento, kerapatan) mengikuti Zendenta V2 karya Fikri Studio. Font tetap Plus Jakarta Sans. Lihat seksi Referensi Zendenta di `design/system/index.html`.

Halaman dokumentasi: `design/system/index.html`. Papan desain: `design/boards/self-service.html` dan `design/boards/kasir.html`. Ketiganya HTML mandiri, CSS inline, tanpa JavaScript.

Bangun ulang:

```
python3 design/system/build.py
```
