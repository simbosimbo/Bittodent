// Menyalin aset render Blender dari design/odontogram/3d-blender/ ke public/odontogram-3d/
// supaya tampilan 3D prototipe selalu memakai folder sumber (termasuk render baru).
// Tidak menulis ke design/odontogram/. Jalankan: npm run sync-3d (juga di predev/prebuild).
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../odontogram/3d-blender')
const dest = resolve(here, '../public/odontogram-3d')
if (!existsSync(src)) {
  console.warn(`sync-3d: sumber tidak ada (${src}) — lewati`)
  process.exit(0)
}
rmSync(dest, { recursive: true, force: true })
const skip = new Set(['preview.html', 'legend-vars.css'])
cpSync(src, dest, { recursive: true, filter: (p) => !skip.has(p.split('/').pop()) })
console.log('sync-3d: 3d-blender → public/odontogram-3d')
