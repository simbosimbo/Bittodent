// Gate for the HeroUI migration: counts legacy class names that collide with HeroUI's BEM classes.
// Done when every module reports 0. Usage: node scripts/legacy-classes.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src', import.meta.url))
const COLLIDING = ['avatar', 'badge', 'card', 'chip', 'menu', 'tabs', 'toast', 'toolbar', 'spinner', 'date-field', 'field-error']
const tok = `(${COLLIDING.join('|')})`
const cssSel = new RegExp(`\\.${tok}(?![\\w-])`, 'g')
// a class token inside a string/template on a line that talks about classes
// `.card` counts only after a quote/space (a CSS selector string), never `ICONS.card` (a property)
const tsxTok = new RegExp(`(?<=["'\`\\s{]|["'\`\\s(]\\.)${tok}(?=["'\`\\s}:\\[),.]|$)`, 'g')
const classLine = /className|class=|classList|querySelector|closest\(|toHaveClass|getElementsByClassName/

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const hits = []
for (const f of walk(root)) {
  if (!/\.(css|tsx?)$/.test(f)) continue
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const isCss = f.endsWith('.css')
    if (!isCss && !classLine.test(line)) return
    for (const m of line.matchAll(isCss ? cssSel : tsxTok)) hits.push({ file: relative(root, f), line: i + 1, cls: m[1] })
  })
}

const area = (f) => (f.startsWith('modules/') ? f.split('/').slice(0, 2).join('/') : f.split('/').slice(0, 2).join('/'))
const byArea = {}
for (const h of hits) byArea[area(h.file)] = (byArea[area(h.file)] ?? 0) + 1

if (process.argv.includes('--json')) console.log(JSON.stringify({ total: hits.length, byArea, hits }, null, 2))
else {
  for (const [a, n] of Object.entries(byArea).sort((x, y) => y[1] - x[1])) console.log(`${String(n).padStart(4)}  ${a}`)
  console.log(`${String(hits.length).padStart(4)}  TOTAL`)
}
process.exit(hits.length ? 1 : 0)
