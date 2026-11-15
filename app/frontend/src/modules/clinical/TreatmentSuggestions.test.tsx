import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Suggestion, Suggestions } from './api'
import TreatmentSuggestions from './TreatmentSuggestions'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const item = (id: string, over: Partial<Suggestion> = {}): Suggestion => ({
  id, state: 'draf', stale: false, tooth: 26, surfaces: ['M', 'O'], condition: 'karies', procedure_code: '23.2', procedure_name: 'Tumpatan (contoh)',
  citations: [{ type: 'finding', id: 'f-m', version: 1, tooth: 26, surface: 'M', condition: 'karies' }, { type: 'finding', id: 'f-o', version: 1, tooth: 26, surface: 'O', condition: 'karies' }],
  rule: { id: 'r', key: 'karies-tumpatan', version: 1, priority: 20 }, signal: { approvals: 0 }, ...over,
})
const payload = (items: Suggestion[], locked = false): Suggestions => ({
  visit_id: 'v1', patient_id: 'p1', locked, items,
  counts: { draf: items.filter((i) => i.state === 'draf').length, disetujui: items.filter((i) => i.state === 'disetujui').length, ditolak: items.filter((i) => i.state === 'ditolak').length },
})

function server(initial: Suggestion[], locked = false) {
  let items = initial
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const m = init?.method ?? 'GET'
    calls.push(`${m} ${url}`)
    if (url === '/sanctum/csrf-cookie') { document.cookie = 'XSRF-TOKEN=abc'; return new Response(null, { status: 204 }) }
    if (m === 'GET' && url === '/api/visits/v1/treatment-suggestions') return json(payload(items, locked))
    const one = url.match(/^\/api\/treatment-suggestions\/(\w+)\/(approve|reject)$/)
    if (one) {
      items = items.map((i) => (i.id === one[1] ? { ...i, state: one[2] === 'approve' ? 'disetujui' : 'ditolak' } : i))
      return json({ id: one[1] })
    }
    if (url === '/api/visits/v1/treatment-suggestions/approve-all') {
      items = items.map((i) => (i.state === 'draf' && !i.stale ? { ...i, state: 'disetujui' } : i))
      return json(payload(items))
    }
    throw new Error('unexpected ' + url)
  }))
  return calls
}
afterEach(() => vi.unstubAllGlobals())

test('one tap approves an item; status chips and reviewed list update; chart reloads', async () => {
  const calls = server([item('a'), item('b', { tooth: 18, surfaces: [], condition: 'sisa_akar', procedure_code: '23.09', procedure_name: 'Pencabutan gigi (contoh)',
    citations: [{ type: 'finding', id: 'f-18', version: 1, tooth: 18, surface: null, condition: 'sisa_akar' }] })])
  const onChanged = vi.fn()
  render(<TreatmentSuggestions patientId="p1" visitId="v1" onChanged={onChanged} />)

  expect(await screen.findByText('✎ 2 draf')).toBeInTheDocument()
  const card = screen.getByRole('listitem', { name: 'Tumpatan (contoh), Gigi 26 · M, O' })
  fireEvent.click(within(card).getByRole('button', { name: '✓ Setujui' }))

  expect(await screen.findByText('✓ 1 disetujui')).toBeInTheDocument()
  expect(screen.getByText('1 sudah diulas')).toBeInTheDocument()
  expect(onChanged).toHaveBeenCalledOnce()
  expect(calls).toContain('POST /api/treatment-suggestions/a/approve')
})

test('Setujui semua approves the open, non-stale items once and then disappears', async () => {
  const calls = server([item('a'), item('b', { tooth: 36, stale: true })])
  render(<TreatmentSuggestions patientId="p1" visitId="v1" />)

  fireEvent.click(await screen.findByRole('button', { name: '✓ Setujui semua (1)' }))
  expect(await screen.findByText('✓ 1 disetujui')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Setujui semua/ })).not.toBeInTheDocument()
  expect(calls.filter((c) => c.endsWith('/approve-all'))).toHaveLength(1)
  // the stale one cannot be approved, only rejected
  const stale = screen.getByRole('listitem', { name: /Gigi 36/ })
  expect(within(stale).getByRole('button', { name: '✓ Setujui' })).toBeDisabled()
  expect(within(stale).getByText('Temuan sumber berubah. Muat ulang saran.')).toBeInTheDocument()
})

test('Tolak is one tap and recorded', async () => {
  const calls = server([item('a')])
  render(<TreatmentSuggestions patientId="p1" visitId="v1" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tolak' }))
  expect(await screen.findByText('✕ 1 ditolak')).toBeInTheDocument()
  expect(calls).toContain('POST /api/treatment-suggestions/a/reject')
})

test('citation chip shows the source findings and highlights them on the odontogram', async () => {
  server([item('a')])
  const onHighlight = vi.fn()
  render(<TreatmentSuggestions patientId="p1" visitId="v1" onHighlight={onHighlight} />)

  const chip = await screen.findByRole('button', { name: 'Sumber: temuan 26 karies M, O' })
  fireEvent.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  expect(onHighlight).toHaveBeenLastCalledWith(['t26-M', 't26-O'])
  const source = screen.getByRole('region', { name: 'Sumber saran' })
  expect(within(source).getByText('Gigi 26 M: Karies')).toBeInTheDocument()
  fireEvent.click(chip)
  expect(onHighlight).toHaveBeenLastCalledWith([])
})

test('a signed visit is read-only (44px targets are measured in the real browser by scripts/a2-screenshots.mjs)', async () => {
  server([item('a')], true)
  render(<TreatmentSuggestions patientId="p1" visitId="v1" />)
  expect(await screen.findByText('Kunjungan sudah ditandatangani; saran hanya bisa dibaca.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '✓ Setujui' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Setujui semua/ })).not.toBeInTheDocument()
})

test('empty state when there are no findings to act on', async () => {
  server([])
  render(<TreatmentSuggestions patientId="p1" visitId="v1" />)
  expect(await screen.findByText(/Tidak ada saran/)).toBeInTheDocument()
})
