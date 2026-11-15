// Measures Tesseract.js (ind+eng, self-hosted lang data) on the synthetic KTP image.
// Does not print or write raw OCR text.
import { createWorker } from 'tesseract.js'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const img = process.argv[2] ?? join(root, 'scripts/fixtures/synthetic-ktp.png')
const langPath = join(root, 'public/tesseract')
const t0 = performance.now()
const worker = await createWorker(['ind', 'eng'], 1, { langPath, gzip: true, logger: () => {}, cachePath: '/tmp/tess-cache' })
const initMs = performance.now() - t0
const t1 = performance.now()
const { data } = await worker.recognize(img)
const recMs = performance.now() - t1
await worker.terminate()
const text = data.text ?? ''
const repaired = text.replace(/O/gi, '0').replace(/[Il]/gi, '1').replace(/B/g, '8').replace(/S/gi, '5').replace(/\D/g, '')
const out = {
  image: img,
  init_ms: Math.round(initMs),
  recognize_ms: Math.round(recMs),
  total_ms: Math.round(initMs + recMs),
  found_synthetic_nik: repaired.includes('3201011501900001'),
  found_name: /BUDI\s+UJI\s+KTP/i.test(text),
  text_chars: text.length,
}
const dest = process.env.OUT ?? '/workspace/audit/ai/a4-ocr-timing.json'
writeFileSync(dest, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
