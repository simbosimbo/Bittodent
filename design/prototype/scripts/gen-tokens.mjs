// Membuat src/styles/tokens.css dari ../tokens.json + warna legenda dari odontogram/legend.json.
// Dijalankan otomatis sebelum dev/build.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(readFileSync(resolve(here, '../../tokens.json'), 'utf8'))
const legend = JSON.parse(readFileSync(resolve(here, '../../odontogram/legend.json'), 'utf8'))
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

const kebab = (k) => k.replace(/_/g, '-')
lines.push('  /* Warna kondisi & status odontogram — SUMBER: design/odontogram/legend.json */')
for (const c of legend.conditions) {
  const key = kebab(c.key)
  lines.push(`  --legend-condition-${key}: ${c.color};`)
  lines.push(`  --color-tooth-${key}: ${c.color};`)
}
for (const s of legend.statuses.items) {
  const key = kebab(s.key)
  lines.push(`  --legend-status-${key}: ${s.color};`)
  lines.push(`  --color-proc-status-${key}: ${s.color};`)
}
if (legend.states?.draft?.color) lines.push(`  --legend-state-draft: ${legend.states.draft.color};`)
if (legend.states?.draft?.wash) lines.push(`  --legend-state-draft-wash: ${legend.states.draft.wash};`)
if (legend.states?.draft?.accent) lines.push(`  --legend-state-draft-accent: ${legend.states.draft.accent};`)
if (legend.states?.signed?.color) lines.push(`  --legend-state-signed: ${legend.states.signed.color};`)
lines.push('  --legend-enamel: var(--color-chart-enamel);')

const css = `/* DIBUAT OTOMATIS dari design/tokens.json + odontogram/legend.json oleh scripts/gen-tokens.mjs. Jangan edit manual. */\n:root {\n${lines.join('\n')}\n}\n`
writeFileSync(resolve(here, '../src/styles/tokens.css'), css)
writeFileSync(resolve(here, '../../tokens.css'), css)
console.log(`tokens.css: ${lines.length} variabel (termasuk ${legend.conditions.length} kondisi + ${legend.statuses.items.length} status dari legend.json)`)

