import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import type { Mark } from './Odontogram'
import { dentitionFromDob, Odontogram3D, recordsFromMarks, teethForDentition, type Record3 } from './Odontogram3D'
import { surfaceLabel, surfaceName } from './legend'

// Synthetic data only. Tooth3D + manifest are mocked so tests never load the real renders.
const view = (anchors: Record<string, number[]>, h: number) => ({ h, cejY: 0.6, mask: 'masks/m.webp', anchors })
const manifest = {
  models: {
    m: {
      crownWidthPx: 40,
      buccal: view({ M: [0.8, 0.7, 0.03], D: [0.2, 0.7, 0.03], O: [0.5, 0.9, 0.05], B: [0.5, 0.7, 0.16], L: [0.5, 0.5, 0.0016] }, 160),
      occlusal: view({ M: [0.85, 0.5, 0.05], D: [0.15, 0.5, 0.05], O: [0.5, 0.5, 0.2], B: [0.5, 0.15, 0.08], L: [0.5, 0.85, 0.08] }, 72),
    },
  },
}

function mockView(record: Record3, v: string) {
  const c = document.createElement('div')
  c.className = 't3'
  c.dataset.tooth = String(record.tooth)
  c.dataset.view = v
  c.setAttribute('role', 'img')
  const whole = record.layers.find((l) => !l.surfaces)
  if (whole) c.dataset.condition = whole.condition
  if (record.baseline) c.dataset.baseline = record.baseline
  const box = document.createElement('div')
  box.className = 't3-box'
  Object.assign(box.style, { width: '40px', height: `${v === 'buccal' ? 160 : 72}px` })
  for (const l of record.layers) for (const s of l.surfaces ?? []) {
    const d = document.createElement('div')
    d.className = 't3-layer'
    Object.assign(d.dataset, { condition: l.condition, status: l.status, surface: s })
    box.appendChild(d)
  }
  c.appendChild(box)
  return c
}

beforeAll(() => {
  window.Tooth3D = { view: mockView, info: (t: number) => ({ model: 'm', scale: 1, upper: [1, 2, 5, 6].includes(Math.floor(t / 10)) }) }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))))
})
afterAll(() => { vi.unstubAllGlobals(); delete window.Tooth3D })

const mk = (condition: string, status?: string): Mark => ({ condition, state: 'draft', source: 'manual', status })
const teethShown = (c: HTMLElement) => [...new Set([...c.querySelectorAll<HTMLElement>('.t3')].map((e) => Number(e.dataset.tooth)))]
const nums = (c: HTMLElement) => [...c.querySelectorAll('.nums span')].map((s) => s.textContent)

test('recordsFromMarks: karies on t16-O and mahkota on t16 become overlay layers with legend status keys', () => {
  const r = recordsFromMarks({ 't16-O': mk('karies', 'kondisi_pantau'), t16: mk('mahkota', 'ada_di_klinik_ini'), 't11-I': mk('tambalan', 'direncanakan') })
  expect(r[16].layers).toEqual([
    { condition: 'karies', surfaces: ['O'], status: 'kondisi' },
    { condition: 'mahkota', status: 'sudah_ada_sini' },
  ])
  expect(r[16].state).toBe('draft')
  expect(r[11].layers[0].status).toBe('direncanakan')
  expect(recordsFromMarks({}, { 18: 'hilang', 17: 'ada' })).toEqual({ 18: { tooth: 18, state: 'empty', layers: [], baseline: 'missing' } })
})

test.each([
  ['tetap', 32, [11, 18, 21, 28, 31, 38, 41, 48], [51, 85]],
  ['sulung', 20, [51, 55, 61, 65, 71, 75, 81, 85], [11, 48]],
  ['campuran', 52, [11, 48, 51, 85], []],
] as const)('dentition %s renders %i FDI teeth', async (dentition, n, has, hasNot) => {
  const { container } = render(<Odontogram3D marks={{}} dentition={dentition} />)
  await waitFor(() => expect(container.querySelector('.t3')).not.toBeNull())
  const shown = teethShown(container)
  expect(shown.sort()).toEqual([...teethForDentition(dentition)].sort())
  expect(shown).toHaveLength(n)
  for (const t of has) { expect(shown).toContain(t); expect(nums(container)).toContain(String(t)) }
  for (const t of hasNot) expect(shown).not.toContain(t)
  expect(nums(container).every((s) => Number(s) >= 11)).toBe(true) // FDI, never Universal 1–32
  expect(screen.getByText('Kanan pasien')).toBeInTheDocument()
  expect(screen.getByText('Kiri pasien')).toBeInTheDocument()
})

test('dentitionFromDob: date-only, frozen clock', () => {
  const now = new Date('2026-06-15T00:00:00Z')
  expect(dentitionFromDob('2022-03-01', now)).toBe('sulung')
  expect(dentitionFromDob('2017-01-10', now)).toBe('campuran')
  expect(dentitionFromDob('1986-05-20', now)).toBe('tetap')
  expect(dentitionFromDob('2020-06-16', now)).toBe('sulung') // turns 6 tomorrow
  expect(dentitionFromDob('2013-06-15', now)).toBe('tetap') // 13 today
  expect(dentitionFromDob(null, now)).toBe('tetap')
  expect(dentitionFromDob('bukan tanggal', now)).toBe('tetap')
})

test('surface labels: I/O by FDI, P on upper, Labial vs Bukal', async () => {
  expect(surfaceName(11, 'B')).toBe('Labial')
  expect(surfaceName(16, 'B')).toBe('Bukal')
  for (const t of [16, 51]) expect(surfaceLabel(t, 'L')).toBe('P')
  for (const t of [46, 85]) expect(surfaceLabel(t, 'L')).toBe('L')
  const onPick = vi.fn()
  const { container } = render(<Odontogram3D marks={{}} dentition="campuran" onPick={onPick} />)
  await waitFor(() => expect(container.querySelector('.t3-hit')).not.toBeNull())
  const hits = (t: number) => [...container.querySelectorAll<HTMLElement>(`.t3[data-tooth="${t}"][data-view="occlusal"] .t3-hit`)].map((h) => h.dataset.surface)
  for (const t of [11, 51]) { expect(hits(t)).toContain('I'); expect(hits(t)).not.toContain('O') }
  for (const t of [16, 55]) { expect(hits(t)).toContain('O'); expect(hits(t)).not.toContain('I') }
  expect(container.querySelector('.t3[data-tooth="11"] .t3-hit[data-surface="I"]')).toHaveAttribute('title', 'Gigi 11, Insisal (I)')
  // Click on the tooth but outside any surface target = center surface.
  fireEvent.click(container.querySelector('.t3[data-tooth="11"][data-view="buccal"]')!)
  expect(onPick).toHaveBeenLastCalledWith(11, 'I')
  fireEvent.click(container.querySelector('.t3[data-tooth="16"][data-view="buccal"]')!)
  expect(onPick).toHaveBeenLastCalledWith(16, 'O')
  fireEvent.keyDown(container.querySelector('.t3[data-tooth="51"][data-view="buccal"]')!, { key: 'Enter' })
  expect(onPick).toHaveBeenLastCalledWith(51, 'I')
})

test('clicking a 3D surface picks (tooth, surface); palatal is stored as L', async () => {
  const onPick = vi.fn()
  const { container, rerender } = render(<Odontogram3D marks={{}} onPick={onPick} />)
  await waitFor(() => expect(container.querySelector('.t3-hit')).not.toBeNull())
  const hit = (t: number, s: string) => container.querySelector<HTMLElement>(`.t3[data-tooth="${t}"][data-view="occlusal"] .t3-hit[data-surface="${s}"]`)!
  expect(hit(26, 'L').title).toBe('Gigi 26, Palatal (P)')
  fireEvent.click(hit(26, 'L'))
  expect(onPick).toHaveBeenLastCalledWith(26, 'L')
  fireEvent.click(hit(36, 'M'))
  expect(onPick).toHaveBeenLastCalledWith(36, 'M')

  rerender(<Odontogram3D marks={{}} onPick={onPick} selected={{ tooth: 26, surface: 'L' }} />)
  await waitFor(() => expect(container.querySelectorAll('.t3.is-sel')).toHaveLength(2))
  expect([...container.querySelectorAll<HTMLElement>('.t3-sel.is-sel')].map((e) => [e.closest<HTMLElement>('.t3')!.dataset.tooth, e.dataset.surface]))
    .toEqual([['26', 'L'], ['26', 'L']])
})

test('karies mark shows as a data-driven overlay; whole-tooth and baseline on the cell', async () => {
  const { container } = render(<Odontogram3D marks={{ 't16-O': mk('karies'), t36: mk('hilang') }} baseline={{ 48: 'belum_tumbuh' }} />)
  await waitFor(() => expect(container.querySelector('.t3-layer')).not.toBeNull())
  expect(container.querySelector('.t3[data-tooth="16"] .t3-layer[data-condition="karies"][data-surface="O"][data-status="kondisi"]')).not.toBeNull()
  expect(container.querySelector('.t3[data-tooth="36"]')).toHaveAttribute('data-condition', 'hilang')
  expect(container.querySelector('.t3[data-tooth="48"]')).toHaveAttribute('data-baseline', 'missing')
})

test('asset failure shows an Indonesian message instead of crashing', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }))
  render(<Odontogram3D marks={{}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('gagal dimuat')
})
