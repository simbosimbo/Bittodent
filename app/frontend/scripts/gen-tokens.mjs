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
// Status colours were added as a second :root (review scroll-travel (a) / #70) and are not yet in design/tokens.json.
const status = `/* Status colours (#70, review scroll-travel (a)): one token set per status, fg on bg >= 4.5:1 (AA); always shown with a label/icon.
   Teal is reserved for buttons; "Perlu konfirmasi" and "Belum bayar" no longer share the warning colours. */
:root {
  --status-confirm-bg: #FFF4DB; --status-confirm-fg: #8A4B00; --status-confirm-border: #E0A526;
  --status-wait-bg: #F1E8FC; --status-wait-fg: #5B2F94; --status-wait-border: #9A6BD6;
  --status-treat-bg: #D3F0EC; --status-treat-fg: #0A5650; --status-treat-border: #14A396;
  --status-unpaid-bg: #FFF1E6; --status-unpaid-fg: #9A3412; --status-unpaid-border: #EA8A5A;
  --status-done-bg: #E8FCDC; --status-done-fg: #1B6E42; --status-done-border: #4CA874;
  --status-alert-bg: #FEF3F2; --status-alert-fg: #B42318; --status-alert-border: #FDA29B;
  --status-booked-bg: #ECF4FC; --status-booked-fg: #1D4F8A; --status-booked-border: #B7D0F5;
}
`
const suffix = tokens.status ? '' : `\n${status}`
writeFileSync(
  resolve(here, '../src/shared/ui/tokens.css'),
  `/* DIBUAT OTOMATIS dari design/tokens.json oleh scripts/gen-tokens.mjs (npm run tokens). Jangan edit manual. */\n:root {\n${lines.join('\n')}\n}\n${suffix}`,
)
console.log(`tokens.css: ${lines.length} variabel`)
