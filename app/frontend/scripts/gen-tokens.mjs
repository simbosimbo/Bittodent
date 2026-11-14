// Generates src/shared/ui/tokens.css from design/tokens.json (same naming as design/prototype/scripts/gen-tokens.mjs,
// without the odontogram legend). Output is committed so Docker builds do not need the design/ folder: run `npm run tokens`.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(readFileSync(resolve(here, '../../../design/tokens.json'), 'utf8'))
const lines = []
const walk = (obj, path) => {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue
    const p = [...path, k]
    if (v && typeof v === 'object') walk(v, p)
    else lines.push(`  --${p.join('-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}: ${v};`)
  }
}
walk(tokens, [])
writeFileSync(
  resolve(here, '../src/shared/ui/tokens.css'),
  `/* DIBUAT OTOMATIS dari design/tokens.json oleh scripts/gen-tokens.mjs (npm run tokens). Jangan edit manual. */\n:root {\n${lines.join('\n')}\n}\n`,
)
console.log(`tokens.css: ${lines.length} variabel`)
