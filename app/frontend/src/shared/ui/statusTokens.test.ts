import { expect, test } from 'vitest'
// @ts-expect-error -- @types/node is not installed; vitest runs on Node, so node:fs exists at test time.
import { readFileSync } from 'node:fs'

// Read the raw files (the vite css pipeline is off in tests, so `?raw` comes back empty).
const css = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8')
const tokens = css('tokens.css'), styles = css('styles.css')

// #70: every status token pair passes WCAG AA (4.5:1), the statuses stay distinct, and teal (buttons) is not a status colour.
const hex = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const STATUSES = ['confirm', 'wait', 'treat', 'unpaid', 'done', 'alert', 'booked']

test.each(STATUSES)('status %s: fg on bg >= 4.5:1', (s) => {
  const bg = hex(`status-${s}-bg`), fg = hex(`status-${s}-fg`)
  expect(bg && fg).toBeTruthy()
  expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5)
})

test.each(STATUSES)('status %s: border >= 3:1 on white and on its own bg (WCAG 1.4.11)', (s) => {
  const bd = hex(`status-${s}-border`)!
  expect(ratio(bd, '#FFFFFF')).toBeGreaterThanOrEqual(3)
  expect(ratio(bd, hex(`status-${s}-bg`)!)).toBeGreaterThanOrEqual(3)
})

test('status tokens are generated from design/tokens.json (one generated :root, so npm run tokens keeps them)', () => {
  expect(tokens).toMatch(/^\/\* DIBUAT OTOMATIS/)
  expect(tokens.match(/:root \{/g)).toHaveLength(1)
})

test('statuses are distinct; "Perlu konfirmasi" and "Belum bayar" no longer share colours; teal stays for buttons', () => {
  const bgs = STATUSES.map((s) => hex(`status-${s}-bg`))
  expect(new Set(bgs).size).toBe(STATUSES.length)
  expect(hex('status-confirm-fg')).not.toBe(hex('status-unpaid-fg'))
  expect(bgs.map((b) => b?.toUpperCase())).not.toContain('#0B6B62')
  for (const c of ['chip-pending_confirmation', 'chip-unpaid', 'chip-checked_in', 'chip-in_treatment', 'chip-done', 'chip-booked'])
    expect(styles).toMatch(new RegExp(`\\.${c} \\{ background: var\\(--status-`))
})
