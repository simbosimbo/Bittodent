# Bitto — prototipe klik (data palsu)

Prototipe UI EHR gigi Bitto. React + TypeScript + Vite. Tanpa backend; semua data dari `src/data/mock.ts`. **Data sintetis saja.**

```bash
npm install && npm run dev
```

Build: `npm run build`. Token desain: `../tokens.json` → `src/styles/tokens.css` (dibuat otomatis sebelum `dev`/`build`, atau `npm run gen`).

## Rute (hash)
`#/login` `#/login/totp` `#/login/recovery` `#/pin`
`#/jadwal` `#/keluarga` `#/keluarga/baru` `#/tagihan` `#/rencana` `#/charting` `#/charting/soap` `#/gambar` `#/kelola` `#/desain` `#/alur`
`#/pasien/RM-000123` → pilih pasien itu, buka Keluarga/Profil.

Flag query (di dalam hash, mis. `#/tagihan?offline=1`): `offline=1|0`, `mode=sederhana|lengkap`, `soap=signed|draft`, `pinTries=0..5`.

## Struktur
- `src/screens/` satu layar per modul
- `src/components/` komponen yang bisa diangkat ke aplikasi asli (Odontogram, SoapEditor, Ledger, Waitboard, PinPad, ...)
- `src/state/store.tsx` state global (pasien aktif, jadwal, tindakan, buku besar, SOAP)
- `src/data/legend.ts` legenda odontogram internal (satu objek, bisa diganti)

## Odontogram & status
- Legenda diambil dari salinan `src/data/odontogram-legend.json` (sumber: `design/odontogram/legend.json`). Label "Legenda internal", bukan formulir resmi.
- Id permukaan palatal/lingual tetap `L`. Label tampak: **P** di rahang atas, **L** di rahang bawah.
- Status tindakan (kondisi, sudah ada di sini, sudah ada di tempat lain, direncanakan, selesai, dirujuk) terpisah dari kondisi gigi. Ditandai **kemungkinan MVP**.

## Cangkang

Seluruh layar setelah login memakai cangkang A (seperti Zendenta): sidebar kiri, bilah atas dengan pencarian + pil **Pasien aktif**, pita alergi/Peringatan, kartu putih di latar berwarna. Login / TOTP / pulih / PIN tetap layar penuh tanpa cangkang. Di tablet (lebar ≤1100px) sidebar merosot ke rel ikon.

Untuk cuplikan keadaan tanpa pasien aktif: `#/jadwal?aktif=0`.

Arah B/C (eksperimen Jadwal) diarsip di `src/shells/_archive/` dan tidak diimpor build.
