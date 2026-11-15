// Copies Tesseract worker + wasm (from node_modules) and checks self-hosted traineddata.
// Runtime never fetches a CDN. Invoked by predev/prebuild.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'public', 'tesseract')
mkdirSync(dest, { recursive: true })

const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
]
for (const [from, to] of copies) {
  const src = join(root, from)
  if (!existsSync(src)) throw new Error(`Missing ${from}. Run npm install first.`)
  copyFileSync(src, join(dest, to))
}
for (const lang of ['eng', 'ind']) {
  const f = join(dest, `${lang}.traineddata.gz`)
  if (!existsSync(f) || statSync(f).size < 1000) {
    throw new Error(`Missing self-hosted ${lang}.traineddata.gz in public/tesseract (do not fetch a CDN at runtime).`)
  }
}
console.log('vendor-tesseract: worker, core, eng+ind ready in public/tesseract')
