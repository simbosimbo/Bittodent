// Menyalin aset render Blender dari design/odontogram/3d-blender/ ke public/odontogram-3d/.
// Build Docker hanya berisi app/frontend (tanpa design/), jadi salinan di public/ ikut di-commit;
// legend-vars.css ikut disalin karena tokens.css aplikasi tidak punya alias --c-* / --state-*.
// Tidak menulis ke design/odontogram/. Jalankan: npm run sync-3d (juga di predev/prebuild).
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../design/odontogram/3d-blender')
const dest = resolve(here, '../public/odontogram-3d')
if (!existsSync(src)) {
  console.warn(`sync-3d: sumber tidak ada (${src}) — lewati, salinan lama di public/odontogram-3d dipertahankan`)
  process.exit(0)
}
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true, filter: (p) => basename(p) !== 'preview.html' })

let files = 0
let bytes = 0
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else { files++; bytes += statSync(p).size }
  }
}
walk(dest)
console.log(`sync-3d: 3d-blender → public/odontogram-3d (${files} berkas, ${(bytes / 1024).toFixed(1)} KiB)`)
